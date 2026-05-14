import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Delete, Loader2 } from "lucide-react";
import bcrypt from "bcryptjs";
import { supabase } from "@/integrations/supabase/client";

async function logPinAttempt(promptId: string, success: boolean) {
  try {
    await supabase.from("pin_attempts").insert({
      prompt_id: promptId,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      success,
    });
  } catch { /* noop */ }
}

const STORAGE_KEY = "unlocked_prompts";
const LOCKOUT_KEY = "pin_lockout_until";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

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
  onClose,
}: {
  promptId: string;
  pinHash: string | null;
  fallbackPin: string;
  open: boolean;
  onUnlock: () => void;
  onClose?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [shake, setShake] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const submittingRef = useRef(false);

  // Restore lockout from sessionStorage on open
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    try {
      const saved = Number(sessionStorage.getItem(LOCKOUT_KEY) ?? "0");
      if (saved > Date.now()) setLockUntil(saved);
    } catch { /* noop */ }
  }, [open]);

  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [lockUntil]);

  const locked = lockUntil > now;
  const remaining = Math.max(0, Math.ceil((lockUntil - now) / 1000));

  const press = (digit: string) => {
    if (locked || verifying) return;
    setPin((cur) => (cur.length >= 5 ? cur : cur + digit));
    setError(null);
  };
  const back = () => { if (!locked && !verifying) { setPin((p) => p.slice(0, -1)); setError(null); } };

  const submit = async (value?: string) => {
    const candidate = value ?? pin;
    if (locked || candidate.length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setVerifying(true);
    let ok = false;
    try {
      if (pinHash) {
        ok = await bcrypt.compare(candidate, pinHash);
      } else {
        ok = candidate === fallbackPin;
      }
    } catch { ok = false; }
    setVerifying(false);
    submittingRef.current = false;
    // fire-and-forget logging
    void logPinAttempt(promptId, ok);
    if (ok) {
      markUnlocked(promptId);
      setPin(""); setError(null); setAttempts(0);
      try { sessionStorage.removeItem(LOCKOUT_KEY); } catch { /* noop */ }
      onUnlock();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setShake((s) => s + 1);
      const left = MAX_ATTEMPTS - next;
      setError(left > 0 ? `Incorrect PIN · ${left} attempt${left === 1 ? "" : "s"} left` : "Incorrect PIN");
      setPin("");
      if (next >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockUntil(until);
        try { sessionStorage.setItem(LOCKOUT_KEY, String(until)); } catch { /* noop */ }
        setAttempts(0);
      }
    }
  };

  // Auto-submit when 5 digits entered
  useEffect(() => {
    if (open && pin.length === 5 && !locked && !verifying) {
      submit(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, open, locked]);

  // Keyboard support
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (locked || verifying) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); back(); }
      else if (e.key === "Enter") { e.preventDefault(); submit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locked, verifying, pin]);

  // Reset state when reopening
  useEffect(() => {
    if (open) { setPin(""); setError(null); }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-md px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            key={shake}
            className="vault-card rounded-2xl p-6 w-full max-w-sm relative"
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1, x: shake ? [0, -8, 8, -6, 6, -3, 3, 0] : 0 }}
            transition={{ duration: 0.4 }}
          >
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              >
                <span aria-hidden>×</span>
              </button>
            )}
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30 mb-3 mx-auto">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-center">Locked prompt</h2>
            <p className="mt-1 text-xs text-muted-foreground text-center">Enter the 5-digit PIN to view</p>

            <div className="mt-5 flex justify-center gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-colors ${error ? "bg-destructive" : i < pin.length ? "bg-primary shadow-glow" : "bg-muted"}`}
                />
              ))}
            </div>

            {verifying && <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Verifying…</div>}
            {error && !verifying && <div className="mt-3 text-xs text-destructive text-center">{error}</div>}
            {locked && <div className="mt-3 text-xs text-destructive text-center">Too many attempts · try again in {remaining}s</div>}

            <div className="mt-5 grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9"].map((d) => (
                <button
                  key={d}
                  onClick={() => press(d)}
                  disabled={locked || verifying}
                  className="h-12 rounded-lg bg-secondary hover:bg-secondary/70 font-semibold text-lg disabled:opacity-40"
                >{d}</button>
              ))}
              <button onClick={back} disabled={locked || verifying} className="h-12 rounded-lg bg-secondary hover:bg-secondary/70 grid place-items-center disabled:opacity-40">
                <Delete className="h-4 w-4" />
              </button>
              <button onClick={() => press("0")} disabled={locked || verifying} className="h-12 rounded-lg bg-secondary hover:bg-secondary/70 font-semibold text-lg disabled:opacity-40">0</button>
              <button onClick={() => submit()} disabled={locked || verifying || pin.length === 0} className="h-12 rounded-lg bg-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
