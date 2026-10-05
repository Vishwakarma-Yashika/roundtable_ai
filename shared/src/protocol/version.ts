import { z } from "zod";

/**
 * Wire protocol version. Bump on any breaking change to an envelope,
 * event or command; clients and servers reject versions they don't speak.
 */
export const PROTOCOL_VERSION = 1 as const;

export const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION);
