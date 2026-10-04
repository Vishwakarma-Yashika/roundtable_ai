import { perspectives } from "@/lib/perspectives";
import { AmbientBackground } from "./AmbientBackground";

const examples = [
  "Should I build this startup?",
  "Should I switch my career?",
  "Is this research idea worth pursuing?",
];

interface LandingPageProps {
  decision: string;
  onDecisionChange: (decision: string) => void;
  onBuildRoom: () => void;
}

export function LandingPage({ decision, onDecisionChange, onBuildRoom }: LandingPageProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <AmbientBackground />

      {/* Navigation */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] shadow-lg">
            <span className="text-lg">◉</span>
          </div>

          <span className="text-lg font-semibold tracking-tight">
            RoundTable
            <span className="text-violet-400">AI</span>
          </span>
        </div>

        <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a
            href="#how-it-works"
            className="transition hover:text-white"
          >
            How it works
          </a>

          <a
            href="#perspectives"
            className="transition hover:text-white"
          >
            Perspectives
          </a>

          <button className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-2.5 text-white transition hover:bg-white/10">
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-20 text-center lg:pt-28">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200 backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
          Multi-perspective AI decision making
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-8xl">
          Don&apos;t ask AI
          <br />
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
            for an answer.
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-zinc-400 sm:text-xl">
          Build a room that argues about it.
          <br className="hidden sm:block" />
          Give us a problem. We&apos;ll bring the right perspectives.
        </p>

        {/* Decision Input */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="group rounded-3xl border border-white/10 bg-white/[0.055] p-2 shadow-2xl shadow-violet-950/20 backdrop-blur-xl">
            <div className="rounded-[22px] border border-white/[0.06] bg-black/30 p-5">
              <div className="mb-3 flex items-center gap-2 text-left text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                <span className="text-violet-400">✦</span>
                Your decision
              </div>

              <textarea
                value={decision}
                onChange={(e) => onDecisionChange(e.target.value)}
                placeholder="What are you trying to decide?"
                rows={3}
                className="w-full resize-none bg-transparent text-lg leading-7 text-white outline-none placeholder:text-zinc-600 sm:text-xl"
              />

              <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-left text-xs text-zinc-600">
                  AI will build the room around your problem
                </span>

                <button
                  onClick={onBuildRoom}
                  disabled={!decision.trim()}
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  ✨ Build My Room
                </button>
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {examples.map((example) => (
              <button
                key={example}
                onClick={() => onDecisionChange(example)}
                className="rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2 text-xs text-zinc-500 transition hover:border-white/15 hover:bg-white/[0.05] hover:text-zinc-300"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Perspectives */}
      <section
        id="perspectives"
        className="relative z-10 mx-auto max-w-6xl px-6 pb-28"
      >
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-400">
            Your room
          </p>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Not one AI. A room full of perspectives.
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500">
            RoundTable dynamically creates the people you need to properly
            challenge a decision.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {perspectives.map((person) => (
            <div
              key={person.role}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-violet-400/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-xl">
                  {person.icon}
                </div>

                <span className="text-xs text-zinc-700 transition group-hover:text-violet-400">
                  AI
                </span>
              </div>

              <h3 className="mt-5 font-semibold">{person.role}</h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {person.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative z-10 border-t border-white/[0.06] bg-white/[0.015]"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-400">
                How it works
              </p>

              <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                Let them
                <br />
                <span className="text-zinc-500">disagree.</span>
              </h2>

              <p className="mt-6 max-w-lg leading-7 text-zinc-500">
                Every participant has a different role, objective and point
                of view. They challenge each other instead of simply agreeing
                with you.
              </p>
            </div>

            <div className="space-y-3">
              {[
                ["01", "Describe your decision", "Tell RoundTable what you're trying to figure out."],
                ["02", "Build the room", "AI selects the perspectives that matter."],
                ["03", "Let them argue", "Agents challenge assumptions and each other."],
                ["04", "Make a better decision", "Get the strongest arguments, risks and next steps."],
              ].map(([number, title, description]) => (
                <div
                  key={number}
                  className="flex gap-5 rounded-2xl border border-white/[0.07] bg-black/20 p-5"
                >
                  <span className="pt-1 text-xs font-mono text-violet-400">
                    {number}
                  </span>

                  <div>
                    <h3 className="font-medium">{title}</h3>

                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-zinc-600 sm:flex-row">
          <span>© 2026 RoundTable AI</span>

          <span>Many perspectives. One better decision.</span>
        </div>
      </footer>
    </main>
  );
}
