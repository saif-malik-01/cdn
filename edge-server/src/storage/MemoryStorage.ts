import { fs } from "memfs";
import path from "path";

import { getCacheDir } from "../libs/cacheFS.js";
import { hashKey } from "../libs/cacheKey.js";
import type { Storage } from "./StorageStrategy.js";

const cacheDir = getCacheDir();
fs.mkdirSync(cacheDir, { recursive: true });

export class MemoryStorage implements Storage {
  async save(key: string, data: Buffer): Promise<string> {
    const hashedKey = hashKey(key);
    const filepath = path.join(cacheDir, hashedKey);
    await fs.promises.writeFile(filepath, data);
    return filepath;
  }

  async get(key: string): Promise<Buffer> {
    const hashedKey = hashKey(key);
    const filepath = path.join(cacheDir, hashedKey);
    const file = await fs.promises.readFile(filepath);
    return file as Buffer;
  }
}

