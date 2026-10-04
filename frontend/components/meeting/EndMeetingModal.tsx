"use client";

import { Modal } from "@/components/ui/Modal";
import { LeaveIcon } from "./icons";

interface EndMeetingModalProps {
  open: boolean;
  perspectiveCount: number;
  messageCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EndMeetingModal({
  open,
  perspectiveCount,
  messageCount,
  onCancel,
  onConfirm,
}: EndMeetingModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="end-meeting-title"
      describedBy="end-meeting-description"
      className="max-w-md"
    >
      <div className="p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/10 text-rose-300">
          <LeaveIcon className="h-5 w-5" />
        </div>

        <h2 id="end-meeting-title" className="mt-5 text-lg font-semibold tracking-tight">
          End this meeting?
        </h2>
        <p id="end-meeting-description" className="mt-2 text-sm leading-6 text-zinc-400">
          {perspectiveCount} {perspectiveCount === 1 ? "perspective" : "perspectives"} will
          stop discussing and the room will close. The transcript of {messageCount}{" "}
          {messageCount === 1 ? "message" : "messages"} stays readable until you leave this
          page — sessions aren&apos;t saved yet.
        </p>

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            Keep discussing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
          >
            End meeting
          </button>
        </div>
      </div>
    </Modal>
  );
}
