import * as vscode from "vscode";

export class SettingsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    settingsFilePath: string
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [vscode.Uri.file(settingsFilePath)],
    };
  }
}
