"use client";

import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-warm-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="font-serif text-lg mb-3">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
