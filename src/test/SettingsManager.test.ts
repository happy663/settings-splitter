import { strict as assert } from "assert";
import {
  ISettingsFileSystem,
  IPathResolver,
  SettingsError,
} from "../core/types";
import { SettingsManager } from "../core/SettingsManager";

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

  test("設定ファイルのマージ", async () => {
    await fileSystem.writeFile("/settings.json", '{"existing": true}');
    await fileSystem.writeFile(
      "/settings/test1.json",
      '{"setting1": "value1"}'
    );
    await fileSystem.writeFile(
      "/settings/test2.json",
      '{"setting2": "value2"}'
    );

    await settingsManager.mergeSettings();

    const mergedContent = fileSystem.getFileContent("/settings.json");
    const merged = JSON.parse(mergedContent!);

    assert.deepStrictEqual(merged, {
      existing: true,
      setting1: "value1",
      setting2: "value2",
    });
  });

  test("設定ファイルの一覧取得", async () => {
    await fileSystem.writeFile("/settings/test1.json", "{}");
    await fileSystem.writeFile("/settings/test2.json", "{}");
    await fileSystem.writeFile("/settings/not-json.txt", "");

    const files = await settingsManager.getSettingsFiles();
    assert.deepStrictEqual(files.sort(), ["test1.json", "test2.json"]);
  });
});
