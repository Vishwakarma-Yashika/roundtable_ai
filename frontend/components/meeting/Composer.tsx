"use client";

import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSpeechInput, type SpeechInputError } from "@/hooks/useSpeechInput";
import type { MeetingCapabilities, RoomMode } from "@/lib/meeting/types";
import { BoltIcon, MicIcon, PlusIcon, SendIcon, StopIcon } from "./icons";
import { SpeakingBars } from "./ParticipantAvatar";

const SPEECH_ERRORS: Record<SpeechInputError, string> = {
  unsupported: "Voice input isn't supported in this browser. Try Chrome or Edge, or type instead.",
  denied: "Microphone access is blocked. Allow it in your browser settings to speak to the room.",
  failed: "Couldn't capture audio. Please try again.",
};

interface ComposerProps {
  mode: RoomMode;
  /** Actions the current backend supports; unsupported ones are disabled. */
  capabilities: MeetingCapabilities;
  onSend: (text: string) => void;
  onChallenge: () => void;
  onAddPerspective: () => void;
}

export function Composer({ mode, capabilities, onSend, onChallenge, onAddPerspective }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Text typed before dictation started; the live transcript is appended to it.
  const dictationBaseRef = useRef("");

  const speech = useSpeechInput((transcript) => {
    setValue(dictationBaseRef.current + transcript);
  });

  // Grow the textarea with its content, up to the CSS max-height.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  const send = () => {
    const text = value.trim();
    if (!text) return;
    // Discard (not stop) dictation: late final results must not refill the input.
    speech.cancel();
    onSend(text);
    setValue("");
    textareaRef.current?.focus();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const toggleMic = () => {
    if (!speech.listening) {
      dictationBaseRef.current = value.trim() ? `${value.trim()} ` : "";
    }
    speech.toggle();
  };

  const challenging = mode === "challenge";

  return (
    <div className="relative z-10 border-t border-white/[0.06] bg-black/40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onChallenge}
            disabled={challenging || !capabilities.challenge}
            title={capabilities.challenge ? undefined : "Not available in live rooms yet"}
            className="flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-500/[0.06] px-3.5 py-2 text-xs font-medium text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-500/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BoltIcon className="h-3.5 w-3.5" />
            {challenging ? "Challenging…" : "Challenge the Room"}
          </button>

          <button
            type="button"
            onClick={onAddPerspective}
            disabled={!capabilities.addPerspective}
            title={capabilities.addPerspective ? undefined : "Not available in live rooms yet"}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-violet-400/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-zinc-300"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Perspective
          </button>

          <span className="ml-auto hidden text-[11px] text-zinc-600 md:block">
            Enter to send · Shift + Enter for a new line
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`mt-2.5 flex items-end gap-2 rounded-2xl border bg-white/[0.04] p-1.5 transition-colors focus-within:border-violet-400/30 ${
            speech.listening ? "border-red-400/30" : "border-white/10"
          }`}
        >
          <button
            type="button"
            onClick={toggleMic}
            aria-label={speech.listening ? "Stop voice input" : "Speak to the room"}
            title={speech.listening ? "Stop voice input" : "Speak to the room"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
              speech.listening
                ? "bg-red-500/90 text-white hover:bg-red-500"
                : "text-zinc-400 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            {speech.listening ? <StopIcon className="h-4 w-4" /> : <MicIcon className="h-[18px] w-[18px]" />}
          </button>

          <label htmlFor="room-composer" className="sr-only">
            Message the room
          </label>
          <textarea
            id="room-composer"
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (speech.error) speech.clearError();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              speech.listening
                ? "Listening…"
                : challenging
                  ? "Defend your position, or add context…"
                  : "Speak or type to the room…"
            }
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[15px] leading-5 text-white outline-none placeholder:text-zinc-600"
          />

          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <SendIcon className="h-[18px] w-[18px]" />
          </button>
        </form>

        <div aria-live="polite" className="min-h-5 pt-1.5 text-[11px]">
          {speech.listening ? (
            <span className="flex items-center gap-2 text-red-300">
              <SpeakingBars className="bg-red-400" />
              Listening — speak to the room, then press stop or send.
            </span>
          ) : speech.error ? (
            <span className="text-amber-300/80">{SPEECH_ERRORS[speech.error]}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
