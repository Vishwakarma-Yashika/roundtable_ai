import { ACCENTS } from "@/lib/meeting/accents";
import { formatDuration } from "@/lib/meeting/format";
import type { Message, Participant } from "@/lib/meeting/types";
import { BoltIcon, ReplyIcon } from "./icons";
import { ParticipantAvatar, SpeakingBars } from "./ParticipantAvatar";

interface MessageBubbleProps {
  message: Message;
  author?: Participant;
  replyTo?: Participant;
  /** True while the author is still "speaking" this message aloud. */
  live?: boolean;
}

export function MessageBubble({ message, author, replyTo, live = false }: MessageBubbleProps) {
  const time = formatDuration(message.at);

  if (message.kind === "system") {
    return (
      <li className="rt-message-in flex items-center gap-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
        <span aria-hidden="true" className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-center">{message.text}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-white/[0.06]" />
      </li>
    );
  }

  if (message.kind === "user") {
    return (
      <li className="rt-message-in flex justify-end">
        <div className="max-w-[88%] sm:max-w-[75%]">
          <p className="mb-1.5 text-right text-xs text-zinc-500">
            You <span className="text-zinc-500">· {time}</span>
          </p>
          <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md border border-white/10 bg-white/[0.08] px-4 py-3 text-[15px] leading-relaxed text-white">
            {message.text}
          </p>
        </div>
      </li>
    );
  }

  if (!author) return null;

  const accent = ACCENTS[author.accent];
  const challenge = message.tone === "challenge";

  if (message.kind === "moderator") {
    return (
      <li
        className={`rt-message-in rounded-2xl border px-4 py-3.5 ${
          challenge
            ? "border-rose-400/20 bg-gradient-to-r from-rose-500/[0.08] to-transparent"
            : "border-violet-400/15 bg-gradient-to-r from-violet-500/[0.07] to-transparent"
        }`}
      >
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em]">
          <span className={challenge ? "text-rose-300" : accent.text}>
            {challenge ? <BoltIcon className="h-3 w-3" /> : author.icon}
          </span>
          <span className={challenge ? "text-rose-300" : accent.text}>
            {author.name} · {challenge ? "Challenge the room" : author.role}
          </span>
          {live && <SpeakingBars className={challenge ? "bg-rose-400" : accent.solid} />}
          <span className="ml-auto font-normal normal-case tracking-normal text-zinc-600">
            {time}
          </span>
        </div>
        <p className="text-[15px] leading-relaxed text-zinc-200">{message.text}</p>
      </li>
    );
  }

  return (
    <li className="rt-message-in flex gap-3">
      <div className="pt-0.5">
        <ParticipantAvatar participant={author} size="sm" active={live} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className={`font-medium ${accent.text}`}>{author.name}</span>
          <span className="text-zinc-600">{author.role}</span>
          {replyTo && (
            <span className="flex items-center gap-1 text-zinc-600">
              <ReplyIcon className="h-3 w-3" />
              <span className="sr-only">responding to</span>
              {replyTo.name.split(" ")[0]}
            </span>
          )}
          {live && <SpeakingBars className={accent.solid} />}
          <span className="ml-auto text-zinc-500">{time}</span>
        </div>

        <div
          className={`rounded-2xl rounded-tl-md border px-4 py-3 ${
            challenge
              ? "border-rose-400/20 bg-rose-500/[0.05]"
              : "border-white/[0.06] bg-white/[0.03]"
          }`}
        >
          {challenge && (
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-rose-300">
              <BoltIcon className="h-3 w-3" />
              Counterargument
            </p>
          )}
          <p className="text-[15px] leading-relaxed text-zinc-200">{message.text}</p>
        </div>
      </div>
    </li>
  );
}
