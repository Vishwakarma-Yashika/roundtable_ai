"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/meeting/format";
import type { RoomMode } from "@/lib/meeting/types";
import { BoltIcon, ClockIcon, LeaveIcon } from "./icons";

interface MeetingHeaderProps {
  decision: string;
  mode: RoomMode;
  ended: boolean;
  durationSeconds: number;
  getElapsedSeconds: () => number;
  onEndMeeting: () => void;
}

export function MeetingHeader({
  decision,
  mode,
  ended,
  durationSeconds,
  getElapsedSeconds,
  onEndMeeting,
}: MeetingHeaderProps) {
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-black/30 px-4 backdrop-blur-xl lg:px-6">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400"
        aria-label="RoundTable AI home"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07]">
          ◉
        </span>
        <span className="hidden text-base font-semibold tracking-tight sm:inline">
          RoundTable<span className="text-violet-400">AI</span>
        </span>
      </Link>

      <span aria-hidden="true" className="hidden h-6 w-px bg-white/10 md:block" />

      <p className="hidden min-w-0 flex-1 truncate text-sm text-zinc-400 md:block" title={decision}>
        {decision}
      </p>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <StatusPill mode={mode} ended={ended} />

        <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-zinc-400">
          <ClockIcon className="h-3.5 w-3.5 text-zinc-600" />
          <span className="sr-only">Meeting duration</span>
          {ended ? (
            formatDuration(durationSeconds)
          ) : (
            <LiveClock getElapsedSeconds={getElapsedSeconds} />
          )}
        </span>

        {!ended && (
          <button
            type="button"
            onClick={onEndMeeting}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
          >
            <LeaveIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">End meeting</span>
            <span className="sm:hidden">End</span>
          </button>
        )}
      </div>
    </header>
  );
}

function LiveClock({ getElapsedSeconds }: { getElapsedSeconds: () => number }) {
  const [seconds, setSeconds] = useState(() => getElapsedSeconds());

  useEffect(() => {
    const interval = setInterval(() => setSeconds(getElapsedSeconds()), 1000);
    return () => clearInterval(interval);
  }, [getElapsedSeconds]);

  return <span role="timer">{formatDuration(seconds)}</span>;
}

function StatusPill({ mode, ended }: { mode: RoomMode; ended: boolean }) {
  if (ended) {
    return (
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
        Ended
      </span>
    );
  }

  if (mode === "challenge") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-rose-200">
        <BoltIcon className="h-3 w-3" />
        <span className="hidden sm:inline">Challenge</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-500/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">
      <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
      </span>
      Live
    </span>
  );
}
