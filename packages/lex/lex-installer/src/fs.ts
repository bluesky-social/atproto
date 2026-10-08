import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

const FILE_URI_PREFIX = 'file://'

export type FileUriString<TPath extends string = string> =
  `${typeof FILE_URI_PREFIX}${TPath}`

export function isFileUriString(val: unknown): val is FileUriString {
  if (typeof val !== 'string') return false
  if (!val.startsWith(FILE_URI_PREFIX)) return false
  try {
    // `new URL` throws on a malformed string; a corrupt manifest value must
    // surface as a clean validation issue, not a raw TypeError.
    return new URL(val).protocol === 'file:'
  } catch {
    return false
  }
}

export function isAbsoluteFileUriString(
  val: unknown,
): val is FileUriString<`/${string}`> {
  return isFileUriString(val) && val.startsWith(`${FILE_URI_PREFIX}/`)
}

export function isRelativeFileUriString(
  val: unknown,
): val is FileUriString<`./${string}` | `../${string}`> {
  return (
    isFileUriString(val) &&
    (val.startsWith(`${FILE_URI_PREFIX}./`) ||
      val.startsWith(`${FILE_URI_PREFIX}../`))
  )
}

export function toFileUri<TPath extends string>(
  path: TPath,
): FileUriString<TPath> {
  return `${FILE_URI_PREFIX}${path}`
}

export function fromFileUri(uri: FileUriString): string {
  return uri.slice(FILE_URI_PREFIX.length)
}

/**
 * Resolves a (possibly relative) `file://` URI to an absolute filesystem path.
 *
 * Relative URIs (`file://./x`, `file://../x`) are anchored to `base`, never to
 * `process.cwd()`. The manifest stores file resolutions as paths relative to
 * the manifest's directory, so callers must pass that directory as `base`;
 * handing the raw relative path to `resolve`/`relative` without a base would
 * silently resolve it against the current working directory instead.
 */
export function resolveFileUri(base: string, uri: FileUriString): string {
  return resolve(base, fromFileUri(uri))
}

function isRelativePath(path: string): path is `./${string}` | `../${string}` {
  return path.startsWith('./') || path.startsWith('../')
}

export function toRelativeFileUri(
  base: string,
  uri: FileUriString,
): FileUriString<`./${string}` | `../${string}`> {
  const path = relative(base, resolveFileUri(base, uri)).split(sep).join('/')
  return toFileUri(isRelativePath(path) ? path : `./${path}`)
}

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
 * - Replaces any existing entry at the path (including a symlink) with a new
 *   regular file, rather than following it
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
  // Replace any existing entry rather than writing through it. A local install
  // leaves a symlink into the source tree at a lexicon's output path; writing
  // with flag 'w' would follow that symlink and overwrite the canonical source.
  await rm(path, { force: true })
  // Trailing newline so the written file is POSIX-friendly and does not thrash against
  // formatters/linters that enforce final newlines (e.g. the tooling in issue #5232).
  const contents = JSON.stringify(data, null, 2) + '\n'
  await writeFile(path, contents, {
    encoding: 'utf8',
    mode: 0o644,
    flag: 'w', // override
  })
}

/**
 * Installs a lexicon file by creating a symbolic link at `destPath` pointing to
 * `sourcePath`, rather than copying its contents.
 *
 * The symlink is written as a path relative to the destination directory so the
 * output tree stays portable (e.g. survives being moved alongside its source).
 * Parent directories are created as needed, and any existing file at the
 * destination is replaced.
 *
 * If, after resolving both paths to absolute form, the destination equals the
 * source, the file is left untouched (no symlink is created) — this covers the
 * case where the lexicon is installed into the directory it already lives in.
 *
 * @param destPath - Where the symlink should be created
 * @param sourcePath - The file the symlink should point to
 */
export async function symlinkLexicon(
  destPath: string,
  sourcePath: string,
): Promise<void> {
  const dest = resolve(destPath)
  const source = resolve(sourcePath)

  // Same path: leave the file in place.
  if (dest === source) return

  await mkdir(dirname(dest), { recursive: true })
  // Replace any existing file/symlink so re-installs are idempotent.
  await rm(dest, { force: true, recursive: true })
  await symlink(relative(dirname(dest), source), dest)
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

export function enoentToNull(err: unknown): null | never {
  if (isEnoentError(err)) return null
  throw err
}
