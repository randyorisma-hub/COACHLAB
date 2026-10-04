import express, { type NextFunction, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import {
  CreatePlaybookSchema,
  GenerateRequestSchema,
  ReviseRequestSchema,
  SaveActivitySchema,
} from "../shared/schema";
import { prepareActivity } from "../shared/pipeline";
import { GenerationError, type PlayGenerator } from "./generators";
import { ForbiddenError, LimitError, NotFoundError, PlaybookStore } from "./store";
import { rateLimit } from "./rateLimit";

export interface AppDeps {
  generator: PlayGenerator;
  store: PlaybookStore;
  /** Directory with the built client (served in production). */
  clientDir?: string;
  aiRequestsPerMinute?: number;
}

const editToken = (req: Request) => req.header("x-edit-token") ?? undefined;

export function createApp({ generator, store, clientDir, aiRequestsPerMinute = 10 }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    );
    next();
  });
  app.use("/api", express.json({ limit: "1mb" }));

  const aiLimiter = rateLimit({ windowMs: 60_000, max: aiRequestsPerMinute });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, mode: generator.mode });
  });

  app.post("/api/generate", aiLimiter, async (req, res, next) => {
    try {
      const body = GenerateRequestSchema.parse(req.body);
      res.json(await generator.generate(body));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/revise", aiLimiter, async (req, res, next) => {
    try {
      const body = ReviseRequestSchema.parse(req.body);
      res.json(await generator.revise(body));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/playbooks", async (req, res, next) => {
    try {
      const { name, team } = CreatePlaybookSchema.parse(req.body);
      res.status(201).json(await store.create(name, team));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/playbooks/:id", async (req, res, next) => {
    try {
      res.json(await store.getForOwner(req.params.id, editToken(req)));
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/playbooks/:id", async (req, res, next) => {
    try {
      const { name, team } = CreatePlaybookSchema.parse(req.body);
      res.json(await store.rename(req.params.id, editToken(req), name, team));
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/playbooks/:id", async (req, res, next) => {
    try {
      await store.delete(req.params.id, editToken(req));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/playbooks/:id/activities", async (req, res, next) => {
    try {
      const body = SaveActivitySchema.parse(req.body);
      // Never trust client data: normalize (and guard attribution) before storing.
      const { activity } = prepareActivity(body.activity, body.origin);
      res.status(201).json(await store.saveActivity(req.params.id, editToken(req), activity, body.origin));
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/playbooks/:id/activities/:savedId", async (req, res, next) => {
    try {
      await store.removeActivity(req.params.id, editToken(req), req.params.savedId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/playbooks/:id/share/rotate", async (req, res, next) => {
    try {
      res.json(await store.rotateShareId(req.params.id, editToken(req)));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/share/:shareId", async (req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await store.getShared(req.params.shareId));
    } catch (err) {
      next(err);
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  if (clientDir && existsSync(clientDir)) {
    app.use(express.static(clientDir, { index: false, maxAge: "1h" }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const { status, message } = toHttpError(err);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: message });
  });

  return app;
}

export function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    return { status: 400, message: `Invalid request: ${first ? `${first.path.join(".")} ${first.message}` : "bad input"}` };
  }
  if (err instanceof SyntaxError) return { status: 400, message: "Invalid JSON body" };
  if (err instanceof NotFoundError) return { status: 404, message: err.message };
  if (err instanceof ForbiddenError) return { status: 403, message: "You don't have edit access to this playbook" };
  if (err instanceof LimitError) return { status: 409, message: err.message };
  if (err instanceof GenerationError) return { status: err.status, message: err.message };
  // Map SDK errors without leaking provider details to the browser.
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { status: 502, message: "The AI service rejected the server's credentials. Check ANTHROPIC_API_KEY." };
  }
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: "The AI service is busy. Try again in a minute." };
  if (err instanceof Anthropic.APIError) return { status: 502, message: "The AI service had a problem. Please try again." };
  const typeError = err as { type?: string; status?: number };
  if (typeError?.type === "entity.too.large") return { status: 413, message: "Request too large" };
  return { status: 500, message: "Something went wrong" };
}
