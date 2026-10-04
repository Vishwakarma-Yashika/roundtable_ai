"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENTS } from "@/lib/meeting/accents";
import type { Activity, Message, Participant, RoomMode } from "@/lib/meeting/types";
import { ArrowDownIcon, BoltIcon } from "./icons";
import { MessageBubble } from "./MessageBubble";
import { ParticipantAvatar, ThinkingDots } from "./ParticipantAvatar";

interface TranscriptProps {
  decision: string;
  isDemo: boolean;
  messages: Message[];
  participants: Participant[];
  activity: Activity | null;
  mode: RoomMode;
  challengeAssumption: string | null;
}

/** Distance from the bottom (px) within which we keep following new messages. */
const STICK_THRESHOLD = 120;

export function Transcript({
  decision,
  isDemo,
  messages,
  participants,
  activity,
  mode,
  challengeAssumption,
}: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const byId = new Map(participants.map((p) => [p.id, p]));
  const thinker =
    activity?.phase === "thinking" ? byId.get(activity.participantId) : undefined;

  // The newest message from whoever currently holds the floor is "live".
  const liveMessageId =
    activity?.phase === "speaking"
      ? [...messages].reverse().find((m) => m.authorId === activity.participantId)?.id
      : undefined;

  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    // Always follow the user's own messages; otherwise only if already at the bottom.
    if (stickToBottomRef.current || lastMessage?.kind === "user") {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
      stickToBottomRef.current = true;
    }
  }, [lastMessage, thinker]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const atBottom = distance < STICK_THRESHOLD;
    stickToBottomRef.current = atBottom;
    if (atBottom === showJump) setShowJump(!atBottom);
  };

  const jumpToLatest = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {mode === "challenge" && (
        <div
          role="status"
          className="rt-fade-in flex items-start gap-3 border-b border-rose-400/15 bg-gradient-to-r from-rose-500/[0.1] via-rose-500/[0.04] to-transparent px-4 py-3 sm:px-6"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300">
            <BoltIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-rose-200">
              Challenge mode — the room is attacking the current position
            </p>
            {challengeAssumption && (
              <p className="mt-0.5 truncate text-xs text-rose-200/60">
                &ldquo;{challengeAssumption}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="rt-scroll min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <header className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              <span className="text-violet-400">✦</span>
              The decision on the table
              {isDemo && (
                <span className="rounded-md border border-white/10 px-1.5 py-px normal-case tracking-normal text-zinc-500">
                  Demo room
                </span>
              )}
            </p>
            <p className="mt-2.5 text-lg font-medium leading-7 text-white sm:text-xl">
              &ldquo;{decision}&rdquo;
            </p>
          </header>

          <div
            role="log"
            aria-label="Meeting transcript"
            aria-live="polite"
            aria-relevant="additions"
          >
            <ol className="space-y-6">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  author={message.authorId ? byId.get(message.authorId) : undefined}
                  replyTo={message.replyToId ? byId.get(message.replyToId) : undefined}
                  live={message.id === liveMessageId}
                />
              ))}
            </ol>
          </div>

          {messages.length === 0 && !thinker && (
            <p className="py-10 text-center text-sm text-zinc-600">
              The room is gathering…
            </p>
          )}

          {thinker && (
            <div className="rt-message-in mt-6 flex items-center gap-3">
              <ParticipantAvatar participant={thinker} size="sm" />
              <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-zinc-500">
                <span>
                  <span className={ACCENTS[thinker.accent].text}>{thinker.name}</span>{" "}
                  is {mode === "challenge" && thinker.kind === "agent" ? "preparing a challenge" : "thinking"}
                </span>
                <ThinkingDots className={ACCENTS[thinker.accent].solid} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="rt-fade-in absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-[#111116]/90 px-3.5 py-2 text-xs text-zinc-300 shadow-lg shadow-black/40 backdrop-blur transition hover:text-white"
        >
          <ArrowDownIcon className="h-3.5 w-3.5" />
          Jump to latest
        </button>
      )}
    </div>
  );
}
