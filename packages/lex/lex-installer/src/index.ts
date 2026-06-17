import { isEnoentError, readJsonFile } from './fs.js'
import { LexInstaller, LexInstallerOptions } from './lex-installer.js'
import {
  LexiconsManifest,
  lexiconsManifestSchema,
} from './lexicons-manifest.js'

/**
 * Options for the {@link install} function.
 *
 * Extends {@link LexInstallerOptions} with additional options for controlling
 * the installation behavior.
 *
 * @example
 * ```typescript
 * const options: LexInstallOptions = {
 *   lexicons: './lexicons',
 *   manifest: './lexicons.manifest.json',
 *   add: ['com.example.myLexicon', 'at://did:plc:xyz/com.example.otherLexicon'],
 *   save: true,
 *   ci: false,
 * }
 * ```
 */
export type LexInstallOptions = LexInstallerOptions & {
  /**
   * Array of lexicons to add to the installation. Can be NSID strings
   * (e.g., 'com.example.myLexicon') or AT URIs
   * (e.g., 'at://did:plc:xyz/com.example.myLexicon').
   */
  add?: string[]

  /**
   * Whether to save the updated manifest after installation.
   * When `true`, the manifest file will be written with any new lexicons.
   * @default false
   */
  save?: boolean

  /**
   * Enable CI mode for strict manifest verification.
   * When `true`, throws an error if the manifest is out of date,
   * useful for continuous integration pipelines.
   * @default false
   */
  ci?: boolean
}

/**
 * Installs lexicons from the network based on the provided options.
 *
 * This is the main entry point for programmatic lexicon installation.
 * It reads an existing manifest (if present), installs any new lexicons,
 * and optionally saves the updated manifest.
 *
 * @param options - Configuration options for the installation
 * @throws {Error} When the manifest file cannot be read (unless it doesn't exist)
 * @throws {Error} When in CI mode and the manifest is out of date
 *
 * @example
 * Install lexicons and save the manifest:
 * ```typescript
 * import { install } from '@atproto/lex-installer'
 *
 * await install({
 *   lexicons: './lexicons',
 *   manifest: './lexicons.manifest.json',
 *   add: ['app.bsky.feed.post', 'app.bsky.actor.profile'],
 *   save: true,
 * })
 * ```
 *
 * @example
 * Verify manifest in CI pipeline:
 * ```typescript
 * import { install } from '@atproto/lex-installer'
 *
 * // Throws if manifest is out of date
 * await install({
 *   lexicons: './lexicons',
 *   manifest: './lexicons.manifest.json',
 *   ci: true,
 * })
 * ```
 *
 * @example
 * Install from specific AT URIs:
 * ```typescript
 * import { install } from '@atproto/lex-installer'
 *
 * await install({
 *   lexicons: './lexicons',
 *   manifest: './lexicons.manifest.json',
 *   add: ['at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post'],
 *   save: true,
 * })
 * ```
 */
export async function install(options: LexInstallOptions) {
  const manifest: LexiconsManifest | undefined = await readJsonFile(
    options.manifest,
  ).then(
    (json) => lexiconsManifestSchema.parse(json),
    (cause: unknown) => {
      if (isEnoentError(cause)) return undefined
      throw new Error('Failed to read lexicons manifest', { cause })
    },
  )

  const additions = new Set(options.add)

  // Perform the installation using the existing manifest as "hint"
  await using installer = new LexInstaller(options)

  await installer.install({ additions, manifest })

  // Verify lockfile
  if (options.ci && (!manifest || !installer.equals(manifest))) {
    throw new Error('Lexicons manifest is out of date')
  }

  // Save changes if requested
  if (options.save) {
    await installer.save()
  }
}
