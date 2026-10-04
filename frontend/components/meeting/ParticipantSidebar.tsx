import type { Participant, ParticipantStatus } from "@/lib/meeting/types";
import { ParticipantCard } from "./ParticipantCard";

interface ParticipantListProps {
  participants: Participant[];
  statusOf: (participant: Participant) => ParticipantStatus;
}

/** Full participant list, shown as a sidebar on large screens. */
export function ParticipantSidebar({ participants, statusOf }: ParticipantListProps) {
  const agents = participants.filter((p) => p.kind === "agent");
  const moderator = participants.find((p) => p.kind === "moderator");

  return (
    <aside
      aria-label="Participants"
      className="rt-scroll hidden w-80 shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-black/20 px-4 py-5 lg:flex"
    >
      <SectionLabel label="Perspectives" count={agents.length} />
      <ul className="mt-3 space-y-2">
        {agents.map((participant) => (
          <ParticipantCard
            key={participant.id}
            participant={participant}
            status={statusOf(participant)}
          />
        ))}
      </ul>

      {moderator && (
        <>
          <div className="mt-6">
            <SectionLabel label="Facilitation" />
          </div>
          <ul className="mt-3">
            <ParticipantCard participant={moderator} status={statusOf(moderator)} />
          </ul>
        </>
      )}
    </aside>
  );
}

/** Horizontally scrolling participant strip for small screens. */
export function ParticipantStrip({ participants, statusOf }: ParticipantListProps) {
  return (
    <div className="border-b border-white/[0.06] bg-black/20 lg:hidden">
      <ul
        aria-label="Participants"
        className="rt-scroll flex gap-1 overflow-x-auto px-3 py-3"
      >
        {participants.map((participant) => (
          <ParticipantCard
            key={participant.id}
            participant={participant}
            status={statusOf(participant)}
            variant="compact"
          />
        ))}
      </ul>
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </h2>
      {count !== undefined && (
        <span className="text-[11px] tabular-nums text-zinc-600">{count}</span>
      )}
    </div>
  );
}
