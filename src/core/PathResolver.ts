import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { IPathResolver } from "./types";

export class PathResolver implements IPathResolver {
  private readonly baseDir: string;
  private readonly settingsFilename: string;
  private readonly settingsDirName: string;

  constructor(options?: {
    baseDir?: string;
    settingsFilename?: string;
    settingsDirName?: string;
  }) {
    // プラットフォームに応じたデフォルトの基本ディレクトリを設定
    let defaultBaseDir: string;
    const platform = process.platform;

    if (platform === "win32") {
      // Windows
      defaultBaseDir = path.join(process.env.APPDATA || "", "Code", "User");
    } else if (platform === "darwin") {
      // macOS
      defaultBaseDir = path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Code",
        "User"
      );
    } else {
      // Linux および その他
      defaultBaseDir = path.join(os.homedir(), ".config", "Code", "User");
    }

    this.baseDir = options?.baseDir || defaultBaseDir;
    this.settingsFilename = options?.settingsFilename || "settings.json";
    this.settingsDirName = options?.settingsDirName || "settings";

    // settings ディレクトリがなければ作成
    const settingsDir = this.getSettingsDirectory();
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
  }

  getSettingsDirectory(): string {
    return path.join(this.baseDir, this.settingsDirName);
  }

  getUserSettingsPath(): string {
    return path.join(this.baseDir, this.settingsFilename);
  }

  getSettingsFilePath(fileName: string): string {
    return path.join(this.getSettingsDirectory(), fileName);
  }
}
