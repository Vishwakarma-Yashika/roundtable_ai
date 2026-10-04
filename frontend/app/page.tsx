"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LandingPage } from "@/components/home/LandingPage";
import { RoomSetup } from "@/components/home/RoomSetup";
import { saveRoomConfig } from "@/lib/meeting/room-config";
import { perspectives, type Perspective } from "@/lib/perspectives";

export default function Home() {
  const router = useRouter();
  const [decision, setDecision] = useState("");
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

  const enterRoom = () => {
    if (selectedPerspectives.length < 2) return;

    saveRoomConfig({
      decision: decision.trim(),
      perspectives: selectedPerspectives.map(({ role, icon, description }) => ({
        role,
        icon,
        description,
      })),
    });

    router.push("/room");
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
