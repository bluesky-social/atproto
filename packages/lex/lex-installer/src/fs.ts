import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readJsonFile(path: string): Promise<unknown> {
  const contents = await readFile(path, 'utf8')
  return JSON.parse(contents)
}

export async function writeJsonFile(
  path: string,
  data: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const contents = JSON.stringify(data, null, 2)
  await writeFile(path, contents, {
    encoding: 'utf8',
    mode: 0o644,
    flag: 'w', // override
  })
}

export function isEnoentError(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT'
}
