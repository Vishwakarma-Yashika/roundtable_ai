import { z } from "zod";
import { RoomIdSchema } from "../domain/ids";
import { USER_MESSAGE_MAX_LENGTH } from "../domain/message";
import { defineCommand } from "./envelope";
import { ProtocolErrorSchema } from "./errors";
import { ProtocolVersionSchema } from "./version";

/** Join (or rejoin) a room. The server replies with a room.snapshot. */
export const RoomJoinCommandSchema = defineCommand(
  "room.join",
  z.object({
    roomId: RoomIdSchema,
    /** Highest seq the client has applied; 0 on first join. */
    lastSeq: z.number().int().nonnegative(),
  })
);

/** Speak to the room. Implicitly interrupts whoever holds the floor. */
export const UserMessageSendCommandSchema = defineCommand(
  "user.message.send",
  z.object({ text: z.string().trim().min(1).max(USER_MESSAGE_MAX_LENGTH) })
);

/** Cut off the current speaker without saying anything. */
export const UserInterruptCommandSchema = defineCommand("user.interrupt", z.object({}));

export const RoomEndCommandSchema = defineCommand("room.end", z.object({}));

export const ClientCommandSchema = z.discriminatedUnion("type", [
  RoomJoinCommandSchema,
  UserMessageSendCommandSchema,
  UserInterruptCommandSchema,
  RoomEndCommandSchema,
]);

export type ClientCommand = z.infer<typeof ClientCommandSchema>;
export type ClientCommandType = ClientCommand["type"];
export type ClientCommandOf<T extends ClientCommandType> = Extract<ClientCommand, { type: T }>;

/** Reply to every command, delivered through the Socket.IO acknowledgement. */
export const CommandAckSchema = z.discriminatedUnion("ok", [
  z.object({ v: ProtocolVersionSchema, clientMsgId: z.string().max(64), ok: z.literal(true) }),
  z.object({
    v: ProtocolVersionSchema,
    clientMsgId: z.string().max(64),
    ok: z.literal(false),
    error: ProtocolErrorSchema,
  }),
]);
export type CommandAck = z.infer<typeof CommandAckSchema>;

/** Socket.IO channel names. */
export const SOCKET_EVENT_CHANNEL = "event";
export const SOCKET_COMMAND_CHANNEL = "command";
