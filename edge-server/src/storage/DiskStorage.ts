import fs from "node:fs";
import path from "path";
import cron from "node-cron";

import { getCacheDir } from "../libs/cacheFS.js";
import { generateRandomKey, hashKey } from "../libs/cacheKey.js";
import type { Storage } from "./StorageStrategy.js";
import { deleteTempFiles } from "../utils/helpers.js";

const cacheDir = getCacheDir();
fs.mkdirSync(cacheDir, { recursive: true });

cron.schedule("0 * * * *", () => {
  deleteTempFiles(cacheDir);
});

export class DiskStorage implements Storage {
  async save(key: string, data: Buffer): Promise<string> {
    const hashedKey = hashKey(key);
    const filepath = path.join(cacheDir, hashedKey);

    const tempPath = path.join(
      cacheDir,
      `.tmp-${hashedKey}-${generateRandomKey()}`
    );
    
    await fs.promises.writeFile(tempPath, data);
    await fs.promises.copyFile(tempPath, filepath);
    await fs.promises.unlink(tempPath);

    return filepath;
  }

  async get(key: string): Promise<Buffer> {
    const hashedKey = hashKey(key);
    const filepath = path.join(cacheDir, hashedKey);
    const file = await fs.promises.readFile(filepath);
    return file as Buffer;
  }

  getPath(key: string): string {
    const hashedKey = hashKey(key);
    return path.join(cacheDir, hashedKey);
  }

  async delete(key: string): Promise<void> {
    const hashedKey = hashKey(key);
    const filepath = path.join(cacheDir, hashedKey);
    await fs.promises.rm(filepath);
  }
}
