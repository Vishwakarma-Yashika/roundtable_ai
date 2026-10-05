import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { SOCKET_EVENT_CHANNEL } from "@roundtable/shared";
import type { Env } from "./config/env";
import { registerRoomRoutes } from "./http/rooms.routes";
import { FakeLlmProvider } from "./llm/FakeLlmProvider";
import type { LlmProvider } from "./llm/LlmProvider";
import { attachGateway, type RoomServer } from "./realtime/gateway";
import type { RoomTiming } from "./rooms/RoomActor";
import { RoomRegistry } from "./rooms/RoomRegistry";

export interface BuildServerOptions {
  env: Env;
  /** Override the provider (tests inject controllable fakes). */
  llm?: LlmProvider;
  timing?: Partial<RoomTiming>;
  logger?: boolean;
}

export interface RoomServerInstance {
  app: FastifyInstance;
  io: RoomServer;
  registry: RoomRegistry;
}

/** Wires Fastify (REST), Socket.IO (realtime) and the room registry. */
export async function buildServer({ env, llm, timing, logger = true }: BuildServerOptions): Promise<RoomServerInstance> {
  const app = Fastify({
    logger: logger ? { level: env.LOG_LEVEL } : false,
    bodyLimit: 16 * 1024,
  });

  await app.register(cors, { origin: env.CORS_ORIGIN, methods: ["GET", "POST"] });

  const io: RoomServer = new Server(app.server, {
    cors: { origin: env.CORS_ORIGIN, methods: ["GET", "POST"] },
    maxHttpBufferSize: 64 * 1024,
    serveClient: false,
  });

  const registry = new RoomRegistry({
    llm: llm ?? createProvider(env),
    maxRooms: env.MAX_ROOMS,
    timing,
    onEvent: (roomId, event) => io.to(roomId).emit(SOCKET_EVENT_CHANNEL, event),
    onError: (error) => app.log.error({ err: error }, "room actor error"),
  });

  registerRoomRoutes(app, registry);
  attachGateway(io, registry);
  registry.startSweeper();

  // Stop rooms and drop sockets before Fastify closes the HTTP server.
  app.addHook("preClose", async () => {
    registry.disposeAll();
    io.disconnectSockets(true);
    io.engine.close();
  });

  return { app, io, registry };
}

function createProvider(env: Env): LlmProvider {
  switch (env.LLM_PROVIDER) {
    case "fake":
      return new FakeLlmProvider({ speed: env.FAKE_LLM_SPEED });
  }
}
