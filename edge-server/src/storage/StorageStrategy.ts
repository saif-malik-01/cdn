import { CONFIG } from "../config.js";
import { DiskStorage } from "./DiskStorage.js";
import { MemoryStorage } from "./MemoryStorage.js";

export interface Storage {
  save(key: string, body: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
}

export class StorageStrategy {
  static decide(sizeMB: number, thresholdMB: number = CONFIG.memoryThresholdMB) {
    if (sizeMB > thresholdMB) {
      return new DiskStorage();
    } else {
      return new MemoryStorage();
    }
  }
}
