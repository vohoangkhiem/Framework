import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT_DIR } from '../config/environment';
import { parseJsonAs, type TypeGuard } from './json-utils';

export interface ListFilesOptions {
  /** e.g. ".json" or [".png", ".jpg"] */
  extension?: string | string[];
  recursive?: boolean;
}

/**
 * Thin, synchronous file-system helpers. Synchronous APIs are deliberate: test setup code is
 * short-lived and readability beats throughput here.
 */
export const FileUtils = {
  resolveFromRoot(...segments: string[]): string {
    return path.join(ROOT_DIR, ...segments);
  },

  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  },

  ensureDir(dirPath: string): string {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
  },

  readText(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  },

  writeText(filePath: string, content: string): void {
    FileUtils.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
  },

  appendLine(filePath: string, line: string): void {
    FileUtils.ensureDir(path.dirname(filePath));
    fs.appendFileSync(filePath, `${line}${os.EOL}`, 'utf8');
  },

  /** Reads and validates a JSON file. Pass a type guard to get a typed result. */
  readJson<T>(filePath: string, guard: TypeGuard<T>): T {
    return parseJsonAs(FileUtils.readText(filePath), guard, path.basename(filePath));
  },

  readJsonUnchecked(filePath: string): unknown {
    return JSON.parse(FileUtils.readText(filePath)) as unknown;
  },

  writeJson(filePath: string, value: unknown): void {
    FileUtils.writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
  },

  remove(targetPath: string): void {
    fs.rmSync(targetPath, { recursive: true, force: true });
  },

  copy(source: string, destination: string): void {
    FileUtils.ensureDir(path.dirname(destination));
    fs.copyFileSync(source, destination);
  },

  sizeInBytes(filePath: string): number {
    return fs.statSync(filePath).size;
  },

  listFiles(dirPath: string, options: ListFilesOptions = {}): string[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    const extensions =
      options.extension === undefined
        ? []
        : [options.extension].flat().map(ext => ext.toLowerCase());
    const results: string[] = [];
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (options.recursive) {
          results.push(...FileUtils.listFiles(fullPath, options));
        }
        continue;
      }
      if (extensions.length === 0 || extensions.includes(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
    return results;
  },

  /** Unique path in the OS temp directory (file is not created). */
  tempFilePath(extension = '.tmp', prefix = 'pw-'): string {
    const name = `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`;
    return path.join(os.tmpdir(), name);
  },
} as const;
