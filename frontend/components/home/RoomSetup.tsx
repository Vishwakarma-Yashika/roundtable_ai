import { perspectives, type Perspective } from "@/lib/perspectives";
import { AmbientBackground } from "./AmbientBackground";

interface RoomSetupProps {
  decision: string;
  selectedPerspectives: Perspective[];
  onTogglePerspective: (perspective: Perspective) => void;
  onReset: () => void;
  onEnterRoom: () => void;
  /** True while the room is being created. */
  entering: boolean;
  enterError: string | null;
}

export function RoomSetup({
  decision,
  selectedPerspectives,
  onTogglePerspective,
  onReset,
  onEnterRoom,
  entering,
  enterError,
}: RoomSetupProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <AmbientBackground />

      {/* Navigation */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <button
          onClick={onReset}
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07]">
            <span className="text-lg">◉</span>
          </div>

          <span className="text-lg font-semibold tracking-tight">
            RoundTable
            <span className="text-violet-400">AI</span>
          </span>
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-2 text-xs text-emerald-300 sm:block">
            ● Room ready
          </div>

          <button
            onClick={onReset}
            className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Start over
          </button>
        </div>
      </nav>

      {/* Room Setup */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-12">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.08] px-4 py-2 text-xs text-violet-200">
            <span>✦</span>
            Your decision room
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Let&apos;s build your
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
              {" "}
              room.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-zinc-500">
            We&apos;ve selected the perspectives most useful for
            challenging your decision.
          </p>
        </div>

        {/* Decision */}
        <div className="mx-auto mt-12 max-w-4xl rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            <span className="text-violet-400">✦</span>
            Your decision
          </div>

          <p className="mt-4 text-xl font-medium leading-8 text-white sm:text-2xl">
            &quot;{decision}&quot;
          </p>
        </div>

        {/* Perspectives */}
        <div className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                AI perspectives
              </p>

              <p className="mt-1 text-sm text-zinc-600">
                Select who you want in the room.
              </p>
            </div>

            <span className="text-xs text-zinc-600">
              {selectedPerspectives.length} selected
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {perspectives.map((perspective) => {
              const selected = selectedPerspectives.some(
                (item) => item.role === perspective.role
              );

              return (
                <button
                  key={perspective.role}
                  onClick={() =>
                    onTogglePerspective(perspective)
                  }
                  className={`group relative overflow-hidden rounded-3xl border p-5 text-left transition duration-300 ${
                    selected
                      ? "border-violet-400/30 bg-white/[0.07]"
                      : "border-white/[0.07] bg-white/[0.025] opacity-60 hover:opacity-100"
                  }`}
                >
                  {/* Glow */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${perspective.color} opacity-40`}
                  />

                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-xl">
                        {perspective.icon}
                      </div>

                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                          selected
                            ? "border-violet-400 bg-violet-400 text-black"
                            : "border-white/15 text-transparent"
                        }`}
                      >
                        ✓
                      </div>
                    </div>

                    <h3 className="mt-6 font-semibold">
                      {perspective.role}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {perspective.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Add perspective */}
        <button
          className="mx-auto mt-8 flex items-center gap-2 rounded-full border border-dashed border-white/10 px-5 py-3 text-sm text-zinc-500 transition hover:border-violet-400/30 hover:text-violet-300"
          onClick={() => {
            alert(
              "Dynamic perspective generation will be connected to the AI backend next."
            );
          }}
        >
          <span className="text-lg">+</span>
          Add another perspective
        </button>

        {/* Enter Room */}
        <div className="mx-auto mt-14 max-w-md">
          <button
            disabled={selectedPerspectives.length < 2 || entering}
            onClick={onEnterRoom}
            className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-semibold text-black shadow-2xl shadow-violet-950/20 transition hover:scale-[1.02] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {entering ? "Entering…" : "Enter The Room"}

            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </button>

          {enterError ? (
            <p role="alert" className="mt-4 text-center text-xs text-rose-300">
              {enterError}
            </p>
          ) : (
            <p className="mt-4 text-center text-xs text-zinc-700">
              You need at least two perspectives to start.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
