import {
  ClientCommandSchema,
  PROTOCOL_VERSION,
  SOCKET_COMMAND_CHANNEL,
  SOCKET_EVENT_CHANNEL,
  type ClientCommandOf,
  type CommandAck,
  type ProtocolError,
  type ServerEvent,
} from "@roundtable/shared";
import type { Server, Socket } from "socket.io";
import type { RoomRegistry } from "../rooms/RoomRegistry";

export interface ServerToClientEvents {
  [SOCKET_EVENT_CHANNEL]: (event: ServerEvent) => void;
}

export interface ClientToServerEvents {
  // The payload is untrusted until validated, and the ack is optional.
  [SOCKET_COMMAND_CHANNEL]: (raw: unknown, ack?: (ack: CommandAck) => void) => void;
}

export interface SocketData {
  roomId?: string;
}

export type RoomServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type RoomSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Transport adapter between Socket.IO and RoomActors. It validates,
 * routes and acknowledges commands — it never changes room state; that is
 * the actor's job alone.
 */
export function attachGateway(io: RoomServer, registry: RoomRegistry): void {
  io.on("connection", (socket) => {
    socket.on(SOCKET_COMMAND_CHANNEL, async (raw, ack) => {
      const respond = typeof ack === "function" ? ack : () => {};
      const parsed = ClientCommandSchema.safeParse(raw);

      if (!parsed.success) {
        respond(nack(readClientMsgId(raw), {
          code: isWrongVersion(raw) ? "unsupported_version" : "invalid_command",
          message: "The command was not understood.",
          retryable: false,
        }));
        return;
      }

      const command = parsed.data;
      if (command.type === "room.join") {
        respond(join(socket, registry, command));
        return;
      }

      const actor = socket.data.roomId ? registry.get(socket.data.roomId) : undefined;
      if (!actor) {
        respond(nack(command.clientMsgId, {
          code: "not_joined",
          message: "Join a room before sending commands.",
          retryable: false,
        }));
        return;
      }

      respond(await actor.handle(command));
    });
  });
}

/** Subscribes the socket to a room and sends it the current state. */
function join(socket: RoomSocket, registry: RoomRegistry, command: ClientCommandOf<"room.join">): CommandAck {
  const { roomId } = command.payload;
  const actor = registry.get(roomId);
  if (!actor) {
    return nack(command.clientMsgId, {
      code: "room_not_found",
      message: "This room doesn't exist or has closed.",
      retryable: false,
    });
  }

  if (socket.data.roomId && socket.data.roomId !== roomId) void socket.leave(socket.data.roomId);
  void socket.join(roomId);
  socket.data.roomId = roomId;

  // M1 always resyncs with a full snapshot; `lastSeq` enables replay later.
  // Sent before the ack: Socket.IO preserves order, so the client has state
  // by the time it learns the join succeeded.
  socket.emit(SOCKET_EVENT_CHANNEL, actor.snapshotEvent());
  return { v: PROTOCOL_VERSION, clientMsgId: command.clientMsgId, ok: true };
}

function nack(clientMsgId: string, error: ProtocolError): CommandAck {
  return { v: PROTOCOL_VERSION, clientMsgId, ok: false, error };
}

function readClientMsgId(raw: unknown): string {
  const id = typeof raw === "object" && raw !== null ? (raw as { clientMsgId?: unknown }).clientMsgId : undefined;
  return typeof id === "string" ? id.slice(0, 64) : "";
}

function isWrongVersion(raw: unknown): boolean {
  return typeof raw === "object" && raw !== null && "v" in raw && (raw as { v: unknown }).v !== PROTOCOL_VERSION;
}
