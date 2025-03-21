import * as path from "path";
import * as os from "os";
import { IPathResolver } from "./types";

export class PathResolver implements IPathResolver {
  getSettingsDirectory(): string {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Code",
      "User",
      "settings"
    );
  }

  getUserSettingsPath(): string {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Code",
      "User",
      "settings.json"
    );
  }

  getSettingsFilePath(fileName: string): string {
    return path.join(this.getSettingsDirectory(), fileName);
  }
}
