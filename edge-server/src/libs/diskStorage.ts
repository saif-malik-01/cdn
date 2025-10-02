import fs from "node:fs";
import path from "path";

import { getCacheDir } from "./cacheFS.js";
import { hashKey } from "./cacheKey.js";

const cacheDir = getCacheDir();
fs.mkdirSync(cacheDir, { recursive: true });

async function save(key: string, data: Buffer): Promise<string> {
  const hashedKey = hashKey(key);
  const filepath = path.join(cacheDir, hashedKey);
  await fs.promises.writeFile(filepath, data);
  return filepath;
}

async function get(key: string): Promise<Buffer> {
  const hashedKey = hashKey(key);
  const filepath = path.join(cacheDir, hashedKey);
  const file = await fs.promises.readFile(filepath);
  return file as Buffer;
}

export default { save, get };
