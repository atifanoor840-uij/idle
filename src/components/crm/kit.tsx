"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { goToAdminSignin } from "@/lib/crmApi";
import { useApi } from "@/lib/portal-data";
import { btnPrimary, btnSecondary, cx, FormMessage } from "@/components/portal/ui";
import { inputCls } from "@/components/portal/kit";

/** useApi that sends signed-out / non-admin sessions to the admin sign-in. */
export function useAdmin<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  return useApi(fn, deps, goToAdminSignin);
}

export const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export function SearchBox({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(inputCls, "pl-9")} />
    </label>
  );
}

/** Case-insensitive match of a query against any of the given fields. */
export const matches = (q: string, ...fields: unknown[]) => {
  const n = q.trim().toLowerCase();
  return !n || fields.some((f) => String(f ?? "").toLowerCase().includes(n));
};

/* Accessible modal built on <dialog>; Escape and the close button dismiss it. */
export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx("w-[calc(100%-1.5rem)] rounded-card bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 sm:w-[calc(100%-2rem)]", wide ? "max-w-2xl" : "max-w-lg")}
    >
      {open && (
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
            <h2 className="text-[17px] font-bold text-ink sm:text-[18px]">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-surface-2">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Confirm-then-run dialog for destructive or lifecycle-changing actions. */
export function ConfirmAction({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
  withNote,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void>;
  withNote?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setErr("");
      setNote("");
      setBusy(false);
    }
  }, [open]);
  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      await onConfirm(note.trim());
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="space-y-4 text-[14px] text-ink-2">
        <div>{body}</div>
        {withNote && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{withNote}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={cx(inputCls, "h-auto py-2")} />
          </label>
        )}
        {err && <FormMessage tone="error">{err}</FormMessage>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={run} disabled={busy} className={cx(btnPrimary, danger && "!bg-danger !text-white")}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Person({ name, email }: { name?: string; email?: string }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium text-ink">{name || "—"}</span>
      {email && <span className="block truncate text-[12.5px] text-muted">{email}</span>}
    </span>
  );
}

export const linkBtn = "text-[13px] font-medium text-brand-strong hover:underline disabled:opacity-50";
export const dangerLink = "text-[13px] font-medium text-danger hover:underline disabled:opacity-50";
