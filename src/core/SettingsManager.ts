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

    let settings = {};
    for (const file of files) {
      const filePath = this.pathResolver.getSettingsFilePath(file);
      try {
        const content = await this.fileSystem.readFile(filePath);
        // 重要: parseの第二引数にnullを指定して、コメントを保持
        const fileSettings = parse(content, null);
        // 深いマージを行い、コメントなどの特殊構造を保持
        settings = this.deepMerge(settings, fileSettings);
      } catch (error) {
        throw new SettingsError(
          `${file}の処理中にエラーが発生しました`,
          error as Error
        );
      }
    }
    return settings;
  }

  /**
   * 深いマージを行い、コメント情報やCommentArrayを保持する
   */
  private deepMerge(target: any, source: any): any {
    // 最初にtargetが空オブジェクトの場合は、sourceをそのまま返す
    if (Object.keys(target).length === 0) {
      return source;
    }

    const output = { ...target };

    for (const key in source) {
      // ソースがコメントプロパティを持っているか確認する
      const hasComments = Object.getOwnPropertySymbols(source).length > 0;

      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof output[key] === "object" &&
        output[key] !== null &&
        !Array.isArray(output[key])
      ) {
        // オブジェクト同士は再帰的にマージ
        output[key] = this.deepMerge(output[key], source[key]);
      } else if (Array.isArray(source[key])) {
        // 配列の場合、コメント情報を維持するため直接代入
        output[key] = source[key];
      } else {
        // その他の値はコメント情報を保持するため直接代入
        output[key] = source[key];
      }
    }

    // sourceのシンボルプロパティ（コメント情報など）を維持
    Object.getOwnPropertySymbols(source).forEach((sym) => {
      Object.defineProperty(
        output,
        sym,
        Object.getOwnPropertyDescriptor(source, sym)!
      );
    });

    return output;
  }

  async mergeSettings(): Promise<void> {
    try {
      const settingsDir = this.pathResolver.getSettingsDirectory();
      const userSettingsPath = this.pathResolver.getUserSettingsPath();

      // 設定ディレクトリの作成確認
      await this.fileSystem.createDirectory(settingsDir);

      // 重要: parseの第二引数にnullを指定して、コメントを保持
      const currentContent = await this.fileSystem.readFile(userSettingsPath);
      const currentSettings = (await this.fileSystem.exists(userSettingsPath))
        ? parse(currentContent, null)
        : {};

      const newSettings = await this.getNewSettings();

      // スマートマージを実行
      const mergedSettings = this.deepMerge(currentSettings, newSettings);

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

    await this.fileSystem.writeFile(
      filePath,
      "{\n  // ここに設定を追加してください\n}"
    );
  }

  async getSettingsFiles(): Promise<string[]> {
    const settingsDir = this.pathResolver.getSettingsDirectory();
    await this.fileSystem.createDirectory(settingsDir);

    const files = await this.fileSystem.readDirectory(settingsDir);
    return files.filter((file) => file.endsWith(".json"));
  }

  async extractSettingsToFiles(): Promise<void> {
    try {
      const settingsDir = this.pathResolver.getSettingsDirectory();
      const userSettingsPath = this.pathResolver.getUserSettingsPath();

      // 設定ディレクトリの作成確認
      await this.fileSystem.createDirectory(settingsDir);

      // 現在の設定を読み込む（コメント保持）
      const content = await this.fileSystem.readFile(userSettingsPath);
      const currentSettings = parse(content, null);

      // カテゴリごとに分類
      const categories: Record<string, Record<string, unknown>> = {
        editor: {},
        terminal: {},
        workbench: {},
        files: {},
        git: {},
        extensions: {},
        other: {},
      };

      // 設定項目をカテゴリに分類（コメント保持）
      // @ts-ignore
      for (const key of Object.keys(currentSettings)) {
        // @ts-ignore
        const value = currentSettings[key];

        if (key.startsWith("editor.")) {
          categories.editor[key] = value;
        } else if (key.startsWith("terminal.")) {
          categories.terminal[key] = value;
        } else if (key.startsWith("workbench.")) {
          categories.workbench[key] = value;
        } else if (key.startsWith("files.")) {
          categories.files[key] = value;
        } else if (key.startsWith("git.")) {
          categories.git[key] = value;
        } else if (key.includes(".")) {
          // 拡張機能の設定と思われるもの
          categories.extensions[key] = value;
        } else {
          // その他の設定
          categories.other[key] = value;
        }

        // シンボルプロパティ（コメント情報）のコピー
        Object.getOwnPropertySymbols(currentSettings).forEach((sym) => {
          const descriptor = Object.getOwnPropertyDescriptor(
            currentSettings,
            sym
          );
          if (descriptor) {
            // カテゴリオブジェクトにシンボルプロパティを設定
            for (const category of Object.values(categories)) {
              if (key in category) {
                Object.defineProperty(category, sym, descriptor);
              }
            }
          }
        });
      }

      // カテゴリごとにファイルに書き出し
      for (const [category, settings] of Object.entries(categories)) {
        if (Object.keys(settings).length > 0) {
          const filePath = this.pathResolver.getSettingsFilePath(
            `${category}.json`
          );
          await this.fileSystem.writeFile(
            filePath,
            stringify(settings, null, 2)
          );
        }
      }
    } catch (error) {
      throw new SettingsError(
        "設定の抽出中にエラーが発生しました",
        error as Error
      );
    }
  }
}
