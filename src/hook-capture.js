import fs from "node:fs/promises";
import path from "node:path";

export async function appendHookCapture(captureFile, entry) {
  await fs.mkdir(path.dirname(captureFile), { recursive: true });
  await fs.appendFile(
    captureFile,
    `${JSON.stringify({ captured_at: new Date().toISOString(), ...entry })}\n`,
    "utf8"
  );
}
