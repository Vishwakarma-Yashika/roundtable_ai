import type { Metadata } from "next";
import { MeetingRoom } from "@/components/meeting/MeetingRoom";

export const metadata: Metadata = {
  title: "Meeting Room · RoundTable AI",
  description: "A live decision room where AI perspectives debate your decision.",
};

export default function RoomPage() {
  return <MeetingRoom />;
}
