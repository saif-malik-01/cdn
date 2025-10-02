import os from "os";
import path from "path";
import fs from "fs";

export function getCacheDir(appName: string = "quik"): string {
  const platform = os.platform();

  let cacheDir: string;

  if (platform === "win32") {
    // Windows → %LOCALAPPDATA% or fallback to TEMP
    cacheDir = process.env['LOCALAPPDATA'] || os.tmpdir();
    cacheDir = path.join(cacheDir, appName, "Cache");
  } else if (platform === "darwin") {
    // macOS → ~/Library/Caches
    cacheDir = path.join(os.homedir(), "Library", "Caches", appName);
  } else {
    // Linux / Unix → ~/.cache
    cacheDir = path.join(os.homedir(), ".cache", appName);
  }
  
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  return cacheDir;
}
