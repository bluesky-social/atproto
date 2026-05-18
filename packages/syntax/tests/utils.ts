import * as fs from 'node:fs'

export function readLines(filePath: string): string[] {
  return fs
    .readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#') && line.length > 0)
}
