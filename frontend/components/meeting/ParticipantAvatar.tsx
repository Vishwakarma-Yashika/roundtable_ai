import { ACCENTS } from "@/lib/meeting/accents";
import { initials } from "@/lib/meeting/format";
import type { Participant } from "@/lib/meeting/types";

const SIZES = {
  sm: "h-8 w-8 rounded-lg text-sm",
  md: "h-10 w-10 rounded-xl text-base",
  lg: "h-12 w-12 rounded-2xl text-lg",
} as const;

interface ParticipantAvatarProps {
  participant: Participant;
  size?: keyof typeof SIZES;
  active?: boolean;
}

export function ParticipantAvatar({
  participant,
  size = "md",
  active = false,
}: ParticipantAvatarProps) {
  const accent = ACCENTS[participant.accent];

  return (
    <div
      aria-hidden="true"
      className={`relative flex shrink-0 select-none items-center justify-center border transition-shadow duration-300 ${SIZES[size]} ${accent.soft} ${
        active
          ? `${accent.border} ring-2 ${accent.ring} ring-offset-2 ring-offset-[#08080b]`
          : "border-white/10"
      }`}
    >
      {participant.icon ? (
        <span className={participant.kind === "moderator" ? accent.text : undefined}>
          {participant.icon}
        </span>
      ) : (
        <span className={`text-[0.7em] font-semibold tracking-wide ${accent.text}`}>
          {initials(participant.name)}
        </span>
      )}
    </div>
  );
}

/** Animated equaliser shown while a participant is speaking. */
export function SpeakingBars({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
      {[0, 0.15, 0.3, 0.1].map((delay, index) => (
        <span
          key={index}
          className={`rt-eq-bar h-full w-[2px] rounded-full ${className}`}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

/** Three pulsing dots shown while a participant is thinking. */
export function ThinkingDots({ className = "bg-zinc-400" }: { className?: string }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-[3px]">
      {[0, 0.15, 0.3].map((delay) => (
        <span
          key={delay}
          className={`rt-dot h-1 w-1 rounded-full ${className}`}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}
