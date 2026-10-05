"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LandingPage } from "@/components/home/LandingPage";
import { RoomSetup } from "@/components/home/RoomSetup";
import { launchRoom } from "@/lib/meeting/launchRoom";
import { perspectives, type Perspective } from "@/lib/perspectives";

export default function Home() {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);
  const [roomCreated, setRoomCreated] = useState(false);
  const [selectedPerspectives, setSelectedPerspectives] =
    useState<Perspective[]>(perspectives);

  const handleBuildRoom = () => {
    if (!decision.trim()) return;

    setRoomCreated(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const togglePerspective = (perspective: Perspective) => {
    const exists = selectedPerspectives.some(
      (item) => item.role === perspective.role
    );

    if (exists) {
      setSelectedPerspectives(
        selectedPerspectives.filter(
          (item) => item.role !== perspective.role
        )
      );
    } else {
      setSelectedPerspectives([
        ...selectedPerspectives,
        perspective,
      ]);
    }
  };

  const enterRoom = async () => {
    if (selectedPerspectives.length < 2 || entering) return;

    setEntering(true);
    setEnterError(null);
    try {
      const href = await launchRoom({
        decision: decision.trim(),
        perspectives: selectedPerspectives.map(({ role, icon, description }) => ({
          role,
          icon,
          description,
        })),
      });
      router.push(href);
    } catch (error) {
      setEnterError(error instanceof Error ? error.message : "Couldn't open the room.");
      setEntering(false);
    }
  };

  const resetRoom = () => {
    setRoomCreated(false);
    setDecision("");
    setSelectedPerspectives(perspectives);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (roomCreated) {
    return (
      <RoomSetup
        decision={decision}
        selectedPerspectives={selectedPerspectives}
        onTogglePerspective={togglePerspective}
        onReset={resetRoom}
        onEnterRoom={enterRoom}
        entering={entering}
        enterError={enterError}
      />
    );
  }

  return (
    <LandingPage
      decision={decision}
      onDecisionChange={setDecision}
      onBuildRoom={handleBuildRoom}
    />
  );
}
