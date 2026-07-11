import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dirname, "..");
const projectRoot = resolve(webRoot, "..");
const publicRoot = resolve(webRoot, "public");

await mkdir(publicRoot, { recursive: true });
for (const directory of ["assets", "data"]) {
  await cp(resolve(projectRoot, directory), resolve(publicRoot, directory), { recursive: true, force: true });
}
for (const file of ["robots.txt", "sitemap.xml", "ads.txt"]) {
  await cp(resolve(projectRoot, file), resolve(publicRoot, file), { force: true });
}
