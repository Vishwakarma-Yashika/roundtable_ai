import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomIdSchema } from "@roundtable/shared";
import { LiveMeetingRoom } from "@/components/meeting/MeetingRoom";

export const metadata: Metadata = {
  title: "Live Room · RoundTable AI",
  description: "A live decision room where AI perspectives debate your decision.",
};

/** /room/[roomId]: a room run by the room server. /room remains the local demo. */
export default async function LiveRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  // Malformed ids never reach the room server.
  const parsed = RoomIdSchema.safeParse(roomId);
  if (!parsed.success) notFound();

  return <LiveMeetingRoom roomId={parsed.data} />;
}
