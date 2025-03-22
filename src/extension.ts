import * as vscode from "vscode";
import { FileSystem } from "./infrastructure/FileSystem";
import { PathResolver } from "./core/PathResolver";
import { SettingsManager } from "./core/SettingsManager";
import { SettingsTreeDataProvider } from "./ui/SettingsTreeDataProvider";
import { SettingsTreeItem } from "./ui/SettingsTreeItem";
import { SettingsError } from "./core/types";

export function activate(context: vscode.ExtensionContext) {
  // 依存オブジェクトの初期化
  const fileSystem = new FileSystem();
  const pathResolver = new PathResolver();
  const settingsManager = new SettingsManager(fileSystem, pathResolver);

  // UIコンポーネントの初期化
  const settingsTreeDataProvider = new SettingsTreeDataProvider(
    settingsManager,
    pathResolver.getSettingsDirectory()
  );
  vscode.window.registerTreeDataProvider("settingsFiles", settingsTreeDataProvider);

  // コマンドの登録
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "settings-splitter.mergeSettings",
      async () => {
        try {
          await settingsManager.mergeSettings();
          vscode.window.showInformationMessage("設定ファイルのマージが完了しました");
          settingsTreeDataProvider.refresh();
        } catch (error) {
          if (error instanceof SettingsError) {
            vscode.window.showErrorMessage(error.message);
          } else {
            vscode.window.showErrorMessage(`エラーが発生しました: ${error}`);
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "settings-splitter.deleteSettingsFile",
      async (item: SettingsTreeItem) => {
        const answer = await vscode.window.showWarningMessage(
          `${item.label}を削除してもよろしいですか？`,
          { modal: true },
          "削除"
        );

        if (answer === "削除") {
          try {
            await settingsManager.deleteSettingsFile(item.label);
            vscode.window.showInformationMessage(`${item.label}を削除しました`);
            settingsTreeDataProvider.refresh();
          } catch (error) {
            if (error instanceof SettingsError) {
              vscode.window.showErrorMessage(error.message);
            } else {
              vscode.window.showErrorMessage(`エラーが発生しました: ${error}`);
            }
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "settings-splitter.createSettingsFile",
      async () => {
        const fileName = await vscode.window.showInputBox({
          prompt: "新しい設定ファイルの名前を入力してください（.jsonは自動で追加されます）",
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

        try {
          await settingsManager.createSettingsFile(fileName);
          const filePath = pathResolver.getSettingsFilePath(`${fileName}.json`);
          await vscode.window.showTextDocument(vscode.Uri.file(filePath));
          settingsTreeDataProvider.refresh();
        } catch (error) {
          if (error instanceof SettingsError) {
            vscode.window.showErrorMessage(error.message);
          } else {
            vscode.window.showErrorMessage(`エラーが発生しました: ${error}`);
          }
        }
      }
    )
  );

  console.log("Settings Splitter が有効化されました");
}

export function deactivate() {}
