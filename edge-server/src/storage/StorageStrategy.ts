import { DiskStorage } from "./DiskStorage.js";
import { MemoryStorage } from "./MemoryStorage.js";

export interface Storage {
  save(key: string, body: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
}

export class StorageStrategy {
  static decide(sizeMB: number, thresholdMB: number = 1) {
    if (sizeMB > thresholdMB) {
      return new DiskStorage();
    } else {
      return new MemoryStorage();
    }
  }
}
