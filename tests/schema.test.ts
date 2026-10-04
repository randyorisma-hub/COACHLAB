import { describe, expect, it } from "vitest";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { RevisionSchema, SuggestionSetSchema } from "../src/shared/schema";

describe("structured output schemas sent to Claude", () => {
  it("convert to strict JSON schemas (every field required, no extra properties)", () => {
    for (const schema of [SuggestionSetSchema, RevisionSchema]) {
      const format = betaZodOutputFormat(schema) as unknown as { type: string; schema: Record<string, unknown> };
      expect(format.type).toBe("json_schema");
      const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        const n = node as Record<string, unknown>;
        if (n.type === "object" && n.properties) {
          expect(n.additionalProperties).toBe(false);
          expect(new Set(n.required as string[])).toEqual(new Set(Object.keys(n.properties as object)));
        }
        Object.values(n).forEach(walk);
      };
      walk(format.schema);
    }
  });
});
