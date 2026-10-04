import { ACCENTS } from "@/lib/meeting/accents";
import type { Participant, ParticipantStatus } from "@/lib/meeting/types";
import { BoltIcon } from "./icons";
import { ParticipantAvatar, SpeakingBars, ThinkingDots } from "./ParticipantAvatar";

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  challenging: "Challenging",
  left: "Left",
};

interface ParticipantCardProps {
  participant: Participant;
  status: ParticipantStatus;
  /** Compact chips are used in the horizontal mobile strip. */
  variant?: "full" | "compact";
}

export function ParticipantCard({
  participant,
  status,
  variant = "full",
}: ParticipantCardProps) {
  const accent = ACCENTS[participant.accent];
  const active = status === "speaking";
  const label = `${participant.name}, ${participant.role}: ${STATUS_LABEL[status]}`;

  if (variant === "compact") {
    return (
      <li
        aria-label={label}
        className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center"
      >
        <ParticipantAvatar participant={participant} size="md" active={active} />
        <span className="w-full truncate text-[11px] font-medium text-zinc-300">
          {participant.name.split(" ")[0]}
        </span>
        <span className="flex h-3 items-center">
          <StatusIndicator status={status} accentSolid={accent.solid} />
        </span>
      </li>
    );
  }

  return (
    <li
      aria-label={label}
      className={`relative rounded-2xl border p-3 transition-colors duration-300 ${
        active
          ? `${accent.border} bg-white/[0.06]`
          : status === "challenging"
            ? "border-rose-400/15 bg-rose-500/[0.03]"
            : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start gap-3">
        <ParticipantAvatar participant={participant} active={active} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-white">
              {participant.name}
            </p>
            {participant.isCustom && (
              <span className="shrink-0 rounded-md border border-white/10 px-1.5 py-px text-[10px] text-zinc-500">
                Added
              </span>
            )}
          </div>
          <p className={`truncate text-xs ${accent.text} opacity-80`}>
            {participant.role}
          </p>
        </div>

        <div
          className={`flex h-5 shrink-0 items-center gap-1.5 text-[11px] ${
            status === "speaking"
              ? accent.text
              : status === "challenging"
                ? "text-rose-300"
                : "text-zinc-600"
          }`}
        >
          <StatusIndicator status={status} accentSolid={accent.solid} />
          <span>{STATUS_LABEL[status]}</span>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-zinc-500">
        {participant.focus}
      </p>
    </li>
  );
}

function StatusIndicator({
  status,
  accentSolid,
}: {
  status: ParticipantStatus;
  accentSolid: string;
}) {
  switch (status) {
    case "speaking":
      return <SpeakingBars className={accentSolid} />;
    case "thinking":
      return <ThinkingDots />;
    case "challenging":
      return <BoltIcon className="h-3 w-3 text-rose-300" />;
    case "left":
      return <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-zinc-700" />;
    default:
      return <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-zinc-600" />;
  }
}
