import type { AccentKey } from "./types";

export interface AccentClasses {
  /** Foreground text in the accent colour. */
  text: string;
  /** Low-opacity fill for avatars and chips. */
  soft: string;
  /** Hairline border in the accent colour. */
  border: string;
  /** Ring used for the active-speaker state. */
  ring: string;
  /** Solid fill for dots and equaliser bars. */
  solid: string;
}

// Full class strings so Tailwind can detect them at build time.
export const ACCENTS: Record<AccentKey, AccentClasses> = {
  violet: {
    text: "text-violet-300",
    soft: "bg-violet-400/10",
    border: "border-violet-400/30",
    ring: "ring-violet-400/60",
    solid: "bg-violet-400",
  },
  emerald: {
    text: "text-emerald-300",
    soft: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    ring: "ring-emerald-400/60",
    solid: "bg-emerald-400",
  },
  rose: {
    text: "text-rose-300",
    soft: "bg-rose-400/10",
    border: "border-rose-400/30",
    ring: "ring-rose-400/60",
    solid: "bg-rose-400",
  },
  sky: {
    text: "text-sky-300",
    soft: "bg-sky-400/10",
    border: "border-sky-400/30",
    ring: "ring-sky-400/60",
    solid: "bg-sky-400",
  },
  amber: {
    text: "text-amber-300",
    soft: "bg-amber-400/10",
    border: "border-amber-400/30",
    ring: "ring-amber-400/60",
    solid: "bg-amber-400",
  },
  fuchsia: {
    text: "text-fuchsia-300",
    soft: "bg-fuchsia-400/10",
    border: "border-fuchsia-400/30",
    ring: "ring-fuchsia-400/60",
    solid: "bg-fuchsia-400",
  },
  cyan: {
    text: "text-cyan-300",
    soft: "bg-cyan-400/10",
    border: "border-cyan-400/30",
    ring: "ring-cyan-400/60",
    solid: "bg-cyan-400",
  },
  lime: {
    text: "text-lime-300",
    soft: "bg-lime-400/10",
    border: "border-lime-400/30",
    ring: "ring-lime-400/60",
    solid: "bg-lime-400",
  },
  orange: {
    text: "text-orange-300",
    soft: "bg-orange-400/10",
    border: "border-orange-400/30",
    ring: "ring-orange-400/60",
    solid: "bg-orange-400",
  },
  indigo: {
    text: "text-indigo-300",
    soft: "bg-indigo-400/10",
    border: "border-indigo-400/30",
    ring: "ring-indigo-400/60",
    solid: "bg-indigo-400",
  },
};

/** Accents handed out, in order, to perspectives added during the meeting. */
export const CUSTOM_ACCENT_ORDER: AccentKey[] = [
  "fuchsia",
  "cyan",
  "lime",
  "orange",
  "indigo",
  "sky",
  "amber",
  "emerald",
  "rose",
];
