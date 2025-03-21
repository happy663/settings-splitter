import {
  ISettingsFileSystem,
  ISettingsManager,
  IPathResolver,
  SettingsError,
} from "./types";
import { parse, stringify } from "comment-json";

export class SettingsManager implements ISettingsManager {
  constructor(
    private readonly fileSystem: ISettingsFileSystem,
    private readonly pathResolver: IPathResolver
  ) {}

  async getCurrentSettings(): Promise<Record<string, unknown>> {
    const userSettingsPath = this.pathResolver.getUserSettingsPath();

    try {
      const exists = await this.fileSystem.exists(userSettingsPath);
      if (exists) {
        const content = await this.fileSystem.readFile(userSettingsPath);
        return parse(content) as Record<string, unknown>;
      }
      return {};
    } catch (error) {
      throw new SettingsError(
        "settings.jsonの解析に失敗しました",
        error as Error
      );
    }
  }

  async getNewSettings(): Promise<Record<string, unknown>> {
    const settingsDir = this.pathResolver.getSettingsDirectory();
    const files = (await this.fileSystem.readDirectory(settingsDir))
      .filter((file) => file.endsWith(".json"))
      .sort();

    const settings = {};
    for (const file of files) {
      const filePath = this.pathResolver.getSettingsFilePath(file);
      try {
        const content = await this.fileSystem.readFile(filePath);
        Object.assign(settings, parse(content));
      } catch (error) {
        throw new SettingsError(
          `${file}の処理中にエラーが発生しました`,
          error as Error
        );
      }
    }
    return settings;
  }

  async mergeSettings(): Promise<void> {
    try {
      const settingsDir = this.pathResolver.getSettingsDirectory();
      const userSettingsPath = this.pathResolver.getUserSettingsPath();

      // 設定ディレクトリの作成確認
      await this.fileSystem.createDirectory(settingsDir);

      const currentSettings = await this.getCurrentSettings();
      const newSettings = await this.getNewSettings();
      const mergedSettings = { ...currentSettings, ...newSettings };

      // settings.jsonに書き込む
      await this.fileSystem.writeFile(
        userSettingsPath,
        stringify(mergedSettings, null, 2)
      );
    } catch (error) {
      if (error instanceof SettingsError) {
        throw error;
      }
      throw new SettingsError(
        "設定のマージ中にエラーが発生しました",
        error as Error
      );
    }
  }

  async createSettingsFile(fileName: string): Promise<void> {
    if (!fileName) {
      throw new SettingsError("ファイル名は必須です");
    }

    if (fileName.includes(".")) {
      throw new SettingsError("拡張子は自動で追加されます");
    }

    const settingsDir = this.pathResolver.getSettingsDirectory();
    const filePath = this.pathResolver.getSettingsFilePath(`${fileName}.json`);

    await this.fileSystem.createDirectory(settingsDir);

    if (await this.fileSystem.exists(filePath)) {
      throw new SettingsError(`${fileName}.json はすでに存在します`);
    }

    await this.fileSystem.writeFile(filePath, "{\n\n}");
  }

  async getSettingsFiles(): Promise<string[]> {
    const settingsDir = this.pathResolver.getSettingsDirectory();
    await this.fileSystem.createDirectory(settingsDir);

    const files = await this.fileSystem.readDirectory(settingsDir);
    return files.filter((file) => file.endsWith(".json"));
  }
}
