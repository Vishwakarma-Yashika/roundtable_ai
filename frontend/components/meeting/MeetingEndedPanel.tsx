import Link from "next/link";
import { formatDuration } from "@/lib/meeting/format";

interface MeetingEndedPanelProps {
  durationSeconds: number;
  messageCount: number;
  perspectiveCount: number;
  challengeCount: number;
}

export function MeetingEndedPanel({
  durationSeconds,
  messageCount,
  perspectiveCount,
  challengeCount,
}: MeetingEndedPanelProps) {
  const stats = [
    { label: "Duration", value: formatDuration(durationSeconds) },
    { label: "Perspectives", value: perspectiveCount },
    { label: "Messages", value: messageCount },
    { label: "Counterarguments", value: challengeCount },
  ];

  return (
    <div className="rt-fade-in relative z-10 border-t border-white/[0.06] bg-black/40 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Meeting ended</p>
          <dl className="mt-2 grid grid-cols-4 gap-3 sm:flex sm:gap-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                  {stat.label}
                </dt>
                <dd className="mt-0.5 font-mono text-sm tabular-nums text-zinc-300">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          New decision
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
