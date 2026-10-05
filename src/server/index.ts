import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { createGenerator } from "./generators";
import { PlaybookStore } from "./store";
import { createChatEngine } from "./chat";
import { readFileSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Credentials live in .env on the server only (never in client code).
const envFile = path.join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.PORT ?? 8787);
const dataFile = path.resolve(root, process.env.DATA_FILE ?? "data/playbooks.json");

const generator = createGenerator();
// Driven-specific coaching guidelines for the chat assistant (server-side, never sent to browsers as a file).
const guidelinesFile = path.resolve(root, process.env.GUIDELINES_FILE ?? "content/driven-guidelines.md");
const guidelines = existsSync(guidelinesFile) ? readFileSync(guidelinesFile, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim() : "";
const chat = createChatEngine(process.env, guidelines);
const app = createApp({
  generator,
  store: new PlaybookStore(dataFile),
  chat,
  clientDir: path.join(root, "dist/client"),
  aiRequestsPerMinute: Number(process.env.AI_REQUESTS_PER_MINUTE ?? 10),
});

app.listen(port, () => {
  console.log(`Driven Play Lab API on http://localhost:${port}`);
  console.log(
    generator.mode === "ai"
      ? `AI mode: ${process.env.ANTHROPIC_MODEL || "claude-opus-5-5"}`
      : "DEMO MODE: no ANTHROPIC_API_KEY (or DEMO_MODE=1). Suggestions come from the built-in sample library.",
  );
});
