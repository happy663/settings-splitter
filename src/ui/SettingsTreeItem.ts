import * as vscode from "vscode";

export class SettingsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly settingsFilePath: string
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.contextValue = 'settingsFile';
    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [vscode.Uri.file(settingsFilePath)],
    };
  }
}
