import * as vscode from "vscode";
import * as path from "path";
import { ISettingsManager } from "../core/types";
import { SettingsTreeItem } from "../ui/SettingsTreeItem";

export class SettingsTreeDataProvider implements vscode.TreeDataProvider<SettingsTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SettingsTreeItem | undefined | null | void> = new vscode.EventEmitter<SettingsTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SettingsTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(
    private readonly settingsManager: ISettingsManager,
    private readonly settingsDirectory: string
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SettingsTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<SettingsTreeItem[]> {
    const files = await this.settingsManager.getSettingsFiles();
    return files.map(
      file => new SettingsTreeItem(
        file,
        vscode.TreeItemCollapsibleState.None,
        path.join(this.settingsDirectory, file)
      )
    );
  }
}
