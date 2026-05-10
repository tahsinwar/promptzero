import { useState, type FormEvent } from "react";
import { Lock, X } from "lucide-react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

export function PinModal({
  open,
  expectedPin,
  onClose,
  onUnlock,
}: {
  open: boolean;
  expectedPin: string;
  onClose: () => void;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const controls = useAnimation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pin === expectedPin) {
      setPin(""); setError(null); onUnlock();
    } else {
      setError("Incorrect PIN");
      await controls.start({ x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: 0.45 } });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="vault-card rounded-2xl p-6 w-full max-w-sm relative"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={controls}
            exit={{ scale: 0.96, opacity: 0 }}
            style={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30 mb-3">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Locked prompt</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter the PIN to copy this prompt.</p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <input
                autoFocus type="password" inputMode="numeric" value={pin}
                onChange={(e) => { setPin(e.target.value); setError(null); }}
                placeholder="•••••"
                className="w-full rounded-lg border border-border bg-input/40 px-3.5 py-2.5 text-center tracking-widest text-lg outline-none focus:border-primary"
              />
              {error && <div className="text-xs text-destructive">{error}</div>}
              <button type="submit" className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90">
                Unlock
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}