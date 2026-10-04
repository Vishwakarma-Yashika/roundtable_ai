/** Fixed glow-and-grid backdrop shared by the landing and Room Setup screens. */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
      <div className="absolute left-1/2 top-[-250px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px]" />

      <div className="absolute bottom-[-200px] left-[-150px] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />

      <div className="absolute right-[-150px] top-[35%] h-[450px] w-[450px] rounded-full bg-fuchsia-600/10 blur-[140px]" />

      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}
