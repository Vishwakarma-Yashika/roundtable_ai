import { loadEnv } from "./config/env";
import { buildServer } from "./server";

const env = loadEnv();
const { app } = await buildServer({ env });

await app.listen({ port: env.PORT, host: env.HOST });
app.log.info(`Room server ready (LLM provider: ${env.LLM_PROVIDER})`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    app
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error({ err: error }, "shutdown failed");
        process.exit(1);
      });
  });
}
