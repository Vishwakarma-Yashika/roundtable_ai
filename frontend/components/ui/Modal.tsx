"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Id of the element that titles the dialog. */
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible modal built on the native <dialog> element, which provides
 * focus trapping, Escape handling and an inert background for free.
 * Content is unmounted while closed so forms reset between openings.
 * Mark the element that should receive initial focus with `data-autofocus`.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  children,
  className = "max-w-lg",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Only a press that both starts and ends on the backdrop dismisses, so
  // drag-selecting text inside a field and releasing outside doesn't.
  const pressStartedOnBackdropRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs before showModal(), so the dialog would otherwise
      // move focus to its first focusable element. Honour data-autofocus instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Fires for every way the dialog can close natively (Escape, close
      // watchers, programmatic close), keeping React state in sync. When we
      // closed it ourselves, onClose is a harmless repeat.
      onClose={onClose}
      onMouseDown={(event) => {
        pressStartedOnBackdropRef.current = isOnBackdrop(event);
      }}
      onClick={(event) => {
        if (pressStartedOnBackdropRef.current && isOnBackdrop(event)) onClose();
        pressStartedOnBackdropRef.current = false;
      }}
      className={`rt-modal rt-scroll m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto bg-transparent p-0 text-white ${className}`}
    >
      {open && (
        <div className="rounded-3xl border border-white/10 bg-[#0c0c10]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {children}
        </div>
      )}
    </dialog>
  );
}

/**
 * Backdrop clicks target the <dialog> itself but fall outside its box.
 * Checking the box (not just the target) keeps clicks on the dialog's own
 * scrollbar from dismissing it.
 */
function isOnBackdrop(event: MouseEvent<HTMLDialogElement>): boolean {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}
