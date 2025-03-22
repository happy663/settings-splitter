export interface ISettingsFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readDirectory(path: string): Promise<string[]>;
  createDirectory(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}

export interface ISettingsManager {
  mergeSettings(): Promise<void>;
  createSettingsFile(fileName: string): Promise<void>;
  deleteSettingsFile(fileName: string): Promise<void>;
  getSettingsFiles(): Promise<string[]>;
}

export interface IPathResolver {
  getSettingsDirectory(): string;
  getUserSettingsPath(): string;
  getSettingsFilePath(fileName: string): string;
}

export class SettingsError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SettingsError';
  }
}
