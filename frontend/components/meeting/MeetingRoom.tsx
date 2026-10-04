"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMeetingEngine } from "@/hooks/useMeetingEngine";
import {
  DEMO_ROOM_CONFIG,
  parseRoomConfig,
  readStoredRoomConfig,
} from "@/lib/meeting/room-config";
import type {
  NewPerspectiveInput,
  Participant,
  ParticipantStatus,
  RoomConfig,
} from "@/lib/meeting/types";
import { AddPerspectiveModal } from "./AddPerspectiveModal";
import { Composer } from "./Composer";
import { EndMeetingModal } from "./EndMeetingModal";
import { MeetingEndedPanel } from "./MeetingEndedPanel";
import { MeetingHeader } from "./MeetingHeader";
import { ParticipantSidebar, ParticipantStrip } from "./ParticipantSidebar";
import { Transcript } from "./Transcript";

const SERVER_SNAPSHOT = "__server__";
const noopSubscribe = () => () => {};

/**
 * Entry point for /room. Reads the room configured on the setup screen from
 * sessionStorage (client-only), falling back to a demo room.
 */
export function MeetingRoom() {
  const raw = useSyncExternalStore(
    noopSubscribe,
    readStoredRoomConfig,
    () => SERVER_SNAPSHOT
  );

  const stored = useMemo(
    () => (raw === SERVER_SNAPSHOT ? null : parseRoomConfig(raw)),
    [raw]
  );

  if (raw === SERVER_SNAPSHOT) {
    return (
      <RoomShell>
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
          Preparing your room…
        </div>
      </RoomShell>
    );
  }

  return (
    <MeetingSession
      key={raw ?? "demo"}
      config={stored ?? DEMO_ROOM_CONFIG}
      isDemo={!stored}
    />
  );
}

function MeetingSession({ config, isDemo }: { config: RoomConfig; isDemo: boolean }) {
  const {
    controller,
    participants,
    messages,
    activity,
    mode,
    challengeAssumption,
    ended,
    durationSeconds,
  } = useMeetingEngine(config);

  const [addOpen, setAddOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const statusOf = (participant: Participant): ParticipantStatus => {
    if (ended) return "left";
    if (activity?.participantId === participant.id) return activity.phase;
    if (mode === "challenge" && participant.kind === "agent") return "challenging";
    return "listening";
  };

  const agentCount = participants.filter((p) => p.kind === "agent").length;
  const messageCount = messages.filter((m) => m.kind !== "system").length;

  const handleAddPerspective = (input: NewPerspectiveInput) => {
    controller.addPerspective(input);
    setAddOpen(false);
  };

  const handleEndMeeting = () => {
    controller.end();
    setEndOpen(false);
  };

  return (
    <RoomShell>
      <MeetingHeader
        decision={config.decision}
        mode={mode}
        ended={ended}
        durationSeconds={durationSeconds}
        getElapsedSeconds={controller.getElapsedSeconds}
        onEndMeeting={() => setEndOpen(true)}
      />

      <div className="relative z-10 flex min-h-0 flex-1">
        <ParticipantSidebar participants={participants} statusOf={statusOf} />

        <section aria-label="Meeting" className="flex min-w-0 flex-1 flex-col">
          <ParticipantStrip participants={participants} statusOf={statusOf} />

          <Transcript
            decision={config.decision}
            isDemo={isDemo}
            messages={messages}
            participants={participants}
            activity={activity}
            mode={mode}
            challengeAssumption={challengeAssumption}
          />

          {ended ? (
            <MeetingEndedPanel
              durationSeconds={durationSeconds}
              messageCount={messageCount}
              perspectiveCount={agentCount}
              challengeCount={
                messages.filter((m) => m.kind === "agent" && m.tone === "challenge").length
              }
            />
          ) : (
            <Composer
              mode={mode}
              onSend={(text) => controller.sendMessage(text)}
              onChallenge={() => controller.challengeRoom()}
              onAddPerspective={() => setAddOpen(true)}
            />
          )}
        </section>
      </div>

      <AddPerspectiveModal
        open={addOpen}
        existingNames={participants.map((p) => p.name)}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddPerspective}
      />

      <EndMeetingModal
        open={endOpen}
        perspectiveCount={agentCount}
        messageCount={messageCount}
        onCancel={() => setEndOpen(false)}
        onConfirm={handleEndMeeting}
      />
    </RoomShell>
  );
}

function RoomShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[#050505] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-320px] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-violet-600/[0.12] blur-[140px]" />
        <div className="absolute bottom-[-240px] left-[-180px] h-[460px] w-[460px] rounded-full bg-blue-600/[0.07] blur-[140px]" />
        <div className="absolute right-[-180px] top-[40%] h-[420px] w-[420px] rounded-full bg-fuchsia-600/[0.07] blur-[140px]" />
      </div>
      {children}
    </main>
  );
}
