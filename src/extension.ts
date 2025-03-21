import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import JSON5 from "json5";

class SettingsFileProvider implements vscode.TreeDataProvider<SettingsFile> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    SettingsFile | undefined | null | void
  > = new vscode.EventEmitter<SettingsFile | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    SettingsFile | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SettingsFile): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<SettingsFile[]> {
    const settingsDir = getSettingsDirectory();
    if (!fs.existsSync(settingsDir)) {
      return [];
    }

    const files = fs.readdirSync(settingsDir);
    return files
      .filter((file) => file.endsWith(".json"))
      .map(
        (file) => new SettingsFile(file, vscode.TreeItemCollapsibleState.None)
      );
  }
}

class SettingsFile extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [
        vscode.Uri.file(path.join(getSettingsDirectory(), this.label)),
      ],
    };
  }
}

function getSettingsDirectory(): string {
  // macOS: ~/Library/Application Support/Code/User/settings/
  const settingsDir = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Code",
    "User",
    "settings"
  );
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  return settingsDir;
}

async function mergeSettings(): Promise<void> {
  try {
    const settingsDir = getSettingsDirectory();
    const userSettingsPath = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Code",
      "User",
      "settings.json"
    );

    // 現在のsettings.jsonを読み込む
    let currentSettings = {};
    if (fs.existsSync(userSettingsPath)) {
      try {
        const content = fs.readFileSync(userSettingsPath, "utf8");
        currentSettings = JSON5.parse(content);
      } catch (parseError: any) {
        throw new Error(
          `settings.jsonの解析に失敗しました: ${
            parseError?.message || "不明なエラー"
          }`
        );
      }
    }

    // 分割ファイルを読み込んでマージ
    const files = fs
      .readdirSync(settingsDir)
      .filter((file) => file.endsWith(".json"))
      .sort(); // アルファベット順にソート

    for (const file of files) {
      const filePath = path.join(settingsDir, file);
      try {
        const content = fs.readFileSync(filePath, "utf8");
        try {
          const settings = JSON.parse(content);
          currentSettings = { ...currentSettings, ...settings };
        } catch (parseError: any) {
          console.error(`ファイルの内容:\n${content}`);
          throw new Error(
            `${file}の解析に失敗しました:\n` +
              `エラー: ${parseError?.message || "不明なエラー"}\n` +
              `位置: ${parseError?.position || "不明"}\n` +
              `問題のある行: ${
                content.split("\n")[parseError?.line - 1] || "不明"
              }`
          );
        }
      } catch (readError: any) {
        throw new Error(
          `${file}の読み込みに失敗しました: ${
            readError?.message || "不明なエラー"
          }`
        );
      }
    }

    // settings.jsonに書き込む
    fs.writeFileSync(
      userSettingsPath,
      JSON.stringify(currentSettings, null, 2)
    );
    vscode.window.showInformationMessage("設定ファイルのマージが完了しました");
  } catch (error) {
    vscode.window.showErrorMessage(`エラーが発生しました: ${error}`);
  }
}

async function createSettingsFile(): Promise<void> {
  const fileName = await vscode.window.showInputBox({
    prompt:
      "新しい設定ファイルの名前を入力してください（.jsonは自動で追加されます）",
    validateInput: (value: string) => {
      if (!value) {
        return "名前は必須です";
      }
      if (value.includes(".")) {
        return "拡張子は自動で追加されます";
      }
      return null;
    },
  });

  if (!fileName) {
    return;
  }

  const settingsDir = getSettingsDirectory();
  const filePath = path.join(settingsDir, `${fileName}.json`);

  if (fs.existsSync(filePath)) {
    vscode.window.showErrorMessage(`${fileName}.json はすでに存在します`);
    return;
  }

  fs.writeFileSync(filePath, "{\n\n}");
  vscode.window.showTextDocument(vscode.Uri.file(filePath));
}

export function activate(context: vscode.ExtensionContext) {
  // 設定ファイルのTreeViewを登録
  const settingsFileProvider = new SettingsFileProvider();
  vscode.window.registerTreeDataProvider("settingsFiles", settingsFileProvider);

  // コマンドを登録
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "settings-splitter.mergeSettings",
      async () => {
        await mergeSettings();
        settingsFileProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "settings-splitter.createSettingsFile",
      async () => {
        await createSettingsFile();
        settingsFileProvider.refresh();
      }
    )
  );

  console.log("Settings Splitter が有効化されました");
}

export function deactivate() {}
