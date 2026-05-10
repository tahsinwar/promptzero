import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Delete } from "lucide-react";
import bcrypt from "bcryptjs";

const STORAGE_KEY = "unlocked_prompts";

export function isUnlocked(promptId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const arr = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(arr) && arr.includes(promptId);
  } catch { return false; }
}

function markUnlocked(promptId: string) {
  try {
    const arr = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!arr.includes(promptId)) arr.push(promptId);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

export function PinLockModal({
  promptId,
  pinHash,
  fallbackPin,
  open,
  onUnlock,
}: {
  promptId: string;
  pinHash: string | null;
  fallbackPin: string;
  open: boolean;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [lockUntil]);

  const locked = lockUntil > now;
  const remaining = Math.max(0, Math.ceil((lockUntil - now) / 1000));

  const press = (digit: string) => {
    if (locked || pin.length >= 5) return;
    setPin(pin + digit);
    setError(null);
  };
  const back = () => { if (!locked) { setPin(pin.slice(0, -1)); setError(null); } };

  const submit = async () => {
    if (locked || pin.length === 0) return;
    let ok = false;
    if (pinHash) {
      try { ok = await bcrypt.compare(pin, pinHash); } catch { ok = false; }
    } else {
      ok = pin === fallbackPin;
    }
    if (ok) {
      markUnlocked(promptId);
      setPin(""); setError(null); setAttempts(0);
      onUnlock();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setShake((s) => s + 1);
      setError("Incorrect PIN");
      setPin("");
      if (next >= 5) {
        setLockUntil(Date.now() + 30000);
        setAttempts(0);
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-md px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            key={shake}
            className="vault-card rounded-2xl p-6 w-full max-w-sm"
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1, x: shake ? [0, -8, 8, -6, 6, -3, 3, 0] : 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30 mb-3 mx-auto">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-center">Locked prompt</h2>
            <p className="mt-1 text-xs text-muted-foreground text-center">Enter the 5-digit PIN to view</p>

            <div className="mt-5 flex justify-center gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-colors ${i < pin.length ? "bg-primary shadow-glow" : "bg-muted"}`}
                />
              ))}
            </div>

            {error && <div className="mt-3 text-xs text-destructive text-center">{error}</div>}
            {locked && <div className="mt-3 text-xs text-destructive text-center">Too many attempts. Try again in {remaining}s</div>}

            <div className="mt-5 grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9"].map((d) => (
                <button
                  key={d}
                  onClick={() => press(d)}
                  disabled={locked}
                  className="h-12 rounded-lg bg-secondary hover:bg-secondary/70 font-semibold text-lg disabled:opacity-40"
                >{d}</button>
              ))}
              <button onClick={back} disabled={locked} className="h-12 rounded-lg bg-secondary hover:bg-secondary/70 grid place-items-center disabled:opacity-40">
                <Delete className="h-4 w-4" />
              </button>
              <button onClick={() => press("0")} disabled={locked} className="h-12 rounded-lg bg-secondary hover:bg-secondary/70 font-semibold text-lg disabled:opacity-40">0</button>
              <button onClick={submit} disabled={locked || pin.length === 0} className="h-12 rounded-lg bg-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-40">
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
