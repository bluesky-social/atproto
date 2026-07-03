import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function readLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#') && line.length > 0)
}

export function readInteropFile(name: string): string[] {
  return readLines(
    join(
      import.meta.dirname,
      '..',
      '..',
      '..',
      'interop-test-files',
      'syntax',
      name,
    ),
  )
}
