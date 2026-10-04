import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return nested.flat();
}

describe("credentials stay on the server", () => {
  it("browser code never imports the Anthropic SDK or reads server env vars", async () => {
    const browserDirs = ["src/client", "src/shared"];
    for (const dir of browserDirs) {
      for (const file of await filesUnder(dir)) {
        const src = await readFile(file, "utf8");
        expect(src, file).not.toMatch(/@anthropic-ai\/sdk/);
        expect(src, file).not.toMatch(/ANTHROPIC_|process\.env|import\.meta\.env\.(?!DEV|PROD|MODE)/);
        expect(src, file).not.toMatch(/sk-ant-/);
      }
    }
  });
});
