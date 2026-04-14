import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Reads and parses a JSON file from the filesystem.
 *
 * @param path - Absolute or relative path to the JSON file
 * @returns The parsed JSON content
 * @throws {Error} When the file cannot be read (e.g., ENOENT, EACCES)
 * @throws {SyntaxError} When the file contains invalid JSON
 *
 * @example
 * ```typescript
 * import { readJsonFile } from '@atproto/lex-installer'
 *
 * const manifest = await readJsonFile('./lexicons.manifest.json')
 * ```
 *
 * @example
 * Handle missing file:
 * ```typescript
 * import { readJsonFile, isEnoentError } from '@atproto/lex-installer'
 *
 * try {
 *   const data = await readJsonFile('./config.json')
 * } catch (err) {
 *   if (isEnoentError(err)) {
 *     console.log('File does not exist, using defaults')
 *   } else {
 *     throw err
 *   }
 * }
 * ```
 */
export async function readJsonFile(path: string): Promise<unknown> {
  const contents = await readFile(path, 'utf8')
  return JSON.parse(contents)
}

/**
 * Writes data as formatted JSON to a file.
 *
 * The function:
 * - Creates parent directories if they don't exist
 * - Formats JSON with 2-space indentation
 * - Overwrites existing files
 * - Sets file permissions to 0o644 (rw-r--r--)
 *
 * @param path - Absolute or relative path for the output file
 * @param data - Data to serialize as JSON
 * @throws {Error} When the file cannot be written
 *
 * @example
 * ```typescript
 * import { writeJsonFile } from '@atproto/lex-installer'
 *
 * await writeJsonFile('./output/data.json', {
 *   name: 'example',
 *   values: [1, 2, 3],
 * })
 * ```
 *
 * @example
 * Write a lexicon document:
 * ```typescript
 * import { writeJsonFile } from '@atproto/lex-installer'
 *
 * await writeJsonFile('./lexicons/app/bsky/feed/post.json', lexiconDocument)
 * ```
 */
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

/**
 * Checks if an error is an ENOENT (file not found) error.
 *
 * Useful for handling cases where a file may or may not exist,
 * such as reading an optional configuration file.
 *
 * @param err - The error to check
 * @returns `true` if the error is an ENOENT error, `false` otherwise
 *
 * @example
 * ```typescript
 * import { readFile } from 'node:fs/promises'
 * import { isEnoentError } from '@atproto/lex-installer'
 *
 * const config = await readFile('./config.json').catch((err) => {
 *   if (isEnoentError(err)) {
 *     return { defaults: true }
 *   }
 *   throw err
 * })
 * ```
 *
 * @example
 * In try/catch:
 * ```typescript
 * try {
 *   const manifest = await readFile('./lexicons.manifest.json', 'utf8')
 * } catch (err) {
 *   if (isEnoentError(err)) {
 *     // File doesn't exist, create a new manifest
 *     return { version: 1, lexicons: [], resolutions: {} }
 *   }
 *   throw err
 * }
 * ```
 */
export function isEnoentError(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT'
}
