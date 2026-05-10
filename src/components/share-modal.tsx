import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ShareModal({ open, url, title, onClose }: { open: boolean; url: string; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(url);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${enc}`;
  const text = encodeURIComponent(title);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true); toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="vault-card rounded-2xl p-6 w-full max-w-md relative"
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            <h3 className="text-lg font-bold">Share prompt</h3>
            <div className="mt-4 flex gap-2">
              <input readOnly value={url} className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-sm font-mono truncate" />
              <button onClick={copy} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-5 flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-lg">
                <img src={qr} alt="QR code" width={180} height={180} />
              </div>
              <a href={qr} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Download className="h-3.5 w-3.5" /> Download QR
              </a>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <a target="_blank" rel="noreferrer" href={`https://wa.me/?text=${text}%20${enc}`} className="rounded-lg bg-secondary hover:bg-secondary/70 py-2 text-sm text-center">WhatsApp</a>
              <a target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${text}&url=${enc}`} className="rounded-lg bg-secondary hover:bg-secondary/70 py-2 text-sm text-center">X / Twitter</a>
              <a target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${enc}&text=${text}`} className="rounded-lg bg-secondary hover:bg-secondary/70 py-2 text-sm text-center">Telegram</a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
