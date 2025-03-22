import { strict as assert } from "assert";
import {
  ISettingsFileSystem,
  IPathResolver,
  SettingsError,
} from "../core/types";
import { SettingsManager } from "../core/SettingsManager";
import { parse, stringify } from "comment-json";

class MockFileSystem implements ISettingsFileSystem {
  private files: Map<string, string> = new Map();

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async readDirectory(path: string): Promise<string[]> {
    const prefix = path + "/";
    return Array.from(this.files.keys())
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }

  async createDirectory(_path: string): Promise<void> {
    // ディレクトリ作成のモックは不要
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    this.files.delete(path);
  }

  // テスト用のヘルパーメソッド
  getFileContent(path: string): string | undefined {
    return this.files.get(path);
  }
}

class MockPathResolver implements IPathResolver {
  getSettingsDirectory(): string {
    return "/settings";
  }

  getUserSettingsPath(): string {
    return "/settings.json";
  }

  getSettingsFilePath(fileName: string): string {
    return `/settings/${fileName}`;
  }
}

suite("SettingsManager Test Suite", () => {
  let fileSystem: MockFileSystem;
  let pathResolver: MockPathResolver;
  let settingsManager: SettingsManager;

  setup(() => {
    fileSystem = new MockFileSystem();
    pathResolver = new MockPathResolver();
    settingsManager = new SettingsManager(fileSystem, pathResolver);
  });

  test("新規設定ファイルの作成", async () => {
    await settingsManager.createSettingsFile("test");
    const content = fileSystem.getFileContent("/settings/test.json");
    assert.strictEqual(content, "{\n\n}");
  });

  test("既存ファイル名での作成時にエラーを投げる", async () => {
    await fileSystem.writeFile("/settings/test.json", "{}");

    try {
      await settingsManager.createSettingsFile("test");
      assert.fail("エラーが発生すべき");
    } catch (error: unknown) {
      assert.ok(error instanceof SettingsError);
      assert.strictEqual(
        (error as SettingsError).message,
        "test.json はすでに存在します"
      );
    }
  });

  test("コメント付き設定ファイルのマージ", async () => {
    // コメント付きの元の設定ファイル
    await fileSystem.writeFile(
      "/settings.json",
      `{
        // 既存の設定
        "existing": true
      }`
    );

    // コメント付きの分割設定ファイル
    await fileSystem.writeFile(
      "/settings/test1.json",
      `{
        // テスト設定1
        "setting1": "value1"
      }`
    );

    await fileSystem.writeFile(
      "/settings/test2.json",
      `{
        // テスト設定2
        "setting2": "value2"
      }`
    );

    await settingsManager.mergeSettings();

    const mergedContent = fileSystem.getFileContent("/settings.json");
    const merged = parse(mergedContent!);

    // コンテンツの検証
    assert.deepStrictEqual(merged, {
      existing: true,
      setting1: "value1",
      setting2: "value2",
    });

    // コメントが保持されていることを確認
    assert.ok(mergedContent!.includes("// 既存の設定"));
    assert.ok(mergedContent!.includes("// テスト設定1"));
    assert.ok(mergedContent!.includes("// テスト設定2"));
  });

  test("設定ファイルの一覧取得", async () => {
    await fileSystem.writeFile("/settings/test1.json", "{}");
    await fileSystem.writeFile("/settings/test2.json", "{}");
    await fileSystem.writeFile("/settings/not-json.txt", "");

    const files = await settingsManager.getSettingsFiles();
    assert.deepStrictEqual(files.sort(), ["test1.json", "test2.json"]);
  });

  test("設定ファイルの削除", async () => {
    await fileSystem.writeFile("/settings/test.json", "{}");
    await settingsManager.deleteSettingsFile("test.json");
    assert.strictEqual(await fileSystem.exists("/settings/test.json"), false);
  });

  test("存在しない設定ファイルの削除時にエラーを投げる", async () => {
    try {
      await settingsManager.deleteSettingsFile("notexist.json");
      assert.fail("エラーが発生すべき");
    } catch (error: unknown) {
      assert.ok(error instanceof SettingsError);
      assert.strictEqual(
        (error as SettingsError).message,
        "notexist.json は存在しません"
      );
    }
  });

  test("コメント付きの現在の設定の内容を取得", async () => {
    const settingsWithComment = `{
      // これは重要な設定です
      "existing": true
    }`;
    await fileSystem.writeFile("/settings.json", settingsWithComment);

    const currentSettings = await settingsManager.getCurrentSettings();
    const originalContent = fileSystem.getFileContent("/settings.json");

    // 設定値の検証
    assert.deepStrictEqual(currentSettings, { existing: true });

    // コメントが保持されていることを確認
    assert.ok(originalContent!.includes("// これは重要な設定です"));
  });

  test("コメント付きの新しい設定の内容を取得", async () => {
    await fileSystem.writeFile(
      "/settings/test1.json",
      `{
        // 設定1の説明
        "setting1": "value1"
      }`
    );
    await fileSystem.writeFile(
      "/settings/test2.json",
      `{
        // 設定2の説明
        "setting2": "value2"
      }`
    );

    const newSettings = await settingsManager.getNewSettings();
    const test1Content = fileSystem.getFileContent("/settings/test1.json");
    const test2Content = fileSystem.getFileContent("/settings/test2.json");

    // 設定値の検証
    assert.deepStrictEqual(newSettings, {
      setting1: "value1",
      setting2: "value2",
    });

    // コメントが保持されていることを確認
    assert.ok(test1Content!.includes("// 設定1の説明"));
    assert.ok(test2Content!.includes("// 設定2の説明"));
  });
});
