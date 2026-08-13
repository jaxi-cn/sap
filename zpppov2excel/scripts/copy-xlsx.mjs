import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const source = resolve(projectRoot, "node_modules/xlsx/dist/xlsx.full.min.js");
const target = resolve(projectRoot, "webapp/thirdparty/xlsx.full.min.js");

try {
  await stat(source);
} catch (error) {
  throw new Error("SheetJS is not installed. Run npm install before starting or building the application.", { cause: error });
}

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log("Prepared webapp/thirdparty/xlsx.full.min.js");
