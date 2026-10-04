/** Default perspectives offered on the landing page and Room Setup screen. */
export const perspectives = [
  {
    icon: "💰",
    role: "Investor",
    description: "Looks at opportunity, ROI & financial risk",
    color: "from-emerald-400/20 to-transparent",
  },
  {
    icon: "⚔️",
    role: "Devil's Advocate",
    description: "Challenges assumptions and finds weak points",
    color: "from-red-400/20 to-transparent",
  },
  {
    icon: "💻",
    role: "Technical Expert",
    description: "Evaluates feasibility, complexity & scalability",
    color: "from-blue-400/20 to-transparent",
  },
  {
    icon: "👤",
    role: "Customer",
    description: "Focuses on real user needs and experience",
    color: "from-amber-400/20 to-transparent",
  },
];

export type Perspective = (typeof perspectives)[number];
