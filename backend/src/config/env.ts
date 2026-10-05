import { z } from "zod";

/**
 * Room server configuration, validated once at startup. M1 needs no
 * secrets: the only LLM provider is the local fake.
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  HOST: z.string().min(1).default("127.0.0.1"),
  /** Comma-separated list of origins allowed to call the server. */
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  LLM_PROVIDER: z.enum(["fake"]).default("fake"),
  /** Speed multiplier for the fake provider's artificial latency (2 = twice as fast). */
  FAKE_LLM_SPEED: z.coerce.number().positive().max(1000).default(1),
  /** Upper bound on rooms held in memory, to cap memory use. */
  MAX_ROOMS: z.coerce.number().int().positive().max(10_000).default(200),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
