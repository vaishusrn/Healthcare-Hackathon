import { createApp } from "./app";
import { createDatabase } from "./db/client";
import { migrate } from "./db/migrate";
import { resolveFrontendDir } from "./static";

const db = createDatabase();
migrate(db);

const frontendDir = resolveFrontendDir();
const app = createApp({ db, frontendDir });
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

app.listen({
  hostname,
  port,
});

console.log(`Healthcare API listening on ${app.server?.url}`);
console.log(
  frontendDir
    ? `Serving frontend from ${frontendDir} at /`
    : "Frontend build not found — running API-only (set FRONTEND_DIR to enable)",
);
