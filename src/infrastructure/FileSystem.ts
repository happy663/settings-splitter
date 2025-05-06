import * as fs from "fs/promises";
import { ISettingsFileSystem } from "../core/types";

export class FileSystem implements ISettingsFileSystem {
  async readFile(path: string): Promise<string> {
    return fs.readFile(path, "utf8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    return fs.writeFile(path, content, "utf8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async readDirectory(path: string): Promise<string[]> {
    return fs.readdir(path);
  }

  async createDirectory(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true });
  }

  async deleteFile(path: string): Promise<void> {
    await fs.unlink(path);
  }
}
