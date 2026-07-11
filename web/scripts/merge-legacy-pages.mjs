import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dirname, "..");
const projectRoot = resolve(webRoot, "..");
const outRoot = resolve(webRoot, "out");
await mkdir(outRoot, { recursive: true });

const files = await readdir(projectRoot, { withFileTypes: true });
for (const entry of files) {
  if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
  const destination = resolve(outRoot, entry.name);
  try {
    await access(destination, constants.F_OK);
  } catch {
    await copyFile(resolve(projectRoot, entry.name), destination);
  }
}
