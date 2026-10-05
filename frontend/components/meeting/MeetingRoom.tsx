"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMeetingController } from "@/hooks/useMeetingController";
import { meetingConfig } from "@/lib/meeting/config";
import type { MeetingControllerOptions } from "@/lib/meeting/controllers/createMeetingController";
import {
  DEMO_ROOM_CONFIG,
  parseRoomConfig,
  readStoredRoomConfig,
} from "@/lib/meeting/room-config";
import type {
  MeetingSnapshot,
  NewPerspectiveInput,
  Participant,
  ParticipantStatus,
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
 * Entry point for /room: the local mock meeting. Reads the room configured
 * on the setup screen from sessionStorage (client-only), falling back to a
 * demo room.
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
      options={{ kind: "mock", config: stored ?? DEMO_ROOM_CONFIG }}
      isDemo={!stored}
    />
  );
}

/** Entry point for /room/[roomId]: a room run by the room server. */
export function LiveMeetingRoom({ roomId }: { roomId: string }) {
  return (
    <MeetingSession
      key={roomId}
      options={{ kind: "live", roomId, serverUrl: meetingConfig.roomServerUrl }}
      isDemo={false}
    />
  );
}

function MeetingSession({
  options,
  isDemo,
}: {
  options: MeetingControllerOptions;
  isDemo: boolean;
}) {
  const { controller, snapshot } = useMeetingController(options);
  const {
    decision,
    participants,
    messages,
    activity,
    mode,
    challengeAssumption,
    ended,
    durationSeconds,
  } = snapshot;

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

  // Before the first server snapshot there is no room to render yet.
  if (snapshot.seq === 0) {
    return (
      <RoomShell>
        <RoomPlaceholder snapshot={snapshot} />
      </RoomShell>
    );
  }

  return (
    <RoomShell>
      <MeetingHeader
        decision={decision}
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

          <ConnectionNotice snapshot={snapshot} />

          <Transcript
            decision={decision}
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
              capabilities={controller.capabilities}
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

/** Shown until the first snapshot arrives: connecting, or the room is gone. */
function RoomPlaceholder({ snapshot }: { snapshot: MeetingSnapshot }) {
  const notFound = snapshot.lastError?.code === "room_not_found";

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      {notFound ? (
        <>
          <p className="text-base font-medium text-white">This room isn&apos;t available</p>
          <p className="max-w-sm text-sm text-zinc-500">
            It may have ended, or the link is incorrect. Rooms aren&apos;t saved yet, so a
            server restart also closes them.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            Build a new room
          </Link>
        </>
      ) : (
        <p role="status" className="text-sm text-zinc-500">
          {snapshot.connection === "reconnecting"
            ? "Can't reach the room server. Retrying…"
            : "Connecting to your room…"}
        </p>
      )}
    </div>
  );
}

/** Live rooms only: surfaces a lost connection or a rejected action. */
function ConnectionNotice({ snapshot }: { snapshot: MeetingSnapshot }) {
  const message =
    snapshot.connection === "reconnecting"
      ? "Connection lost. Reconnecting…"
      : snapshot.connection === "offline"
        ? "Disconnected from the room."
        : snapshot.lastError && !snapshot.ended
          ? snapshot.lastError.message
          : null;

  if (!message) return null;

  return (
    <p
      role="status"
      className="rt-fade-in border-b border-amber-400/15 bg-amber-500/[0.06] px-4 py-2 text-center text-xs text-amber-200/90"
    >
      {message}
    </p>
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
