import type { LexInstallerOptions } from './lex-installer.js'
import { LexInstaller } from './lex-installer.js'

/**
 * Options for the {@link install} function.
 *
 * Extends {@link LexInstallerOptions} with additional options for controlling
 * the installation behavior.
 *
 * @example
 * ```typescript
 * const options: InstallOptions = {
 *   lexicons: './lexicons',
 *   manifest: './lexicons.manifest.json',
 *   add: ['com.example.myLexicon', 'at://did:plc:xyz/com.example.otherLexicon'],
 *   save: true,
 *   ci: false,
 * }
 * ```
 */
export type InstallOptions = LexInstallerOptions & {
  /**
   * Array of lexicons NSID strings (e.g., 'com.example.myLexicon') to add to
   * the installation.
   */
  additions?: string[]

  /**
   * Whether to save the updated manifest after installation.
   * When `true`, the manifest file will be written with any new lexicons.
   * @default true
   */
  save?: boolean

  /**
   * Whether to update existing lexicons during installation.
   * When `true`, the installer will attempt to fetch and apply updates
   * for already installed lexicons.
   * @default false
   * @deprecated use {@link update} instead
   */
  update?: boolean

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
export async function install({
  ci = false,
  save = true,
  update = false,
  additions = undefined,
  ...options
}: InstallOptions) {
  // Perform the installation using the existing manifest as "hint"
  await using installer = await LexInstaller.load(options)

  await installer.install({ additions, update })

  // Verify lockfile
  if (ci && installer.requiresSave()) {
    throw new Error('Lexicons manifest is out of date')
  }

  // Save changes if requested
  if (save !== false) {
    await installer.save()
  }
}

export type UpdateOptions = LexInstallerOptions & {
  //
}

export async function update(options: UpdateOptions) {
  // Performs the installation with the update flag enabled
  await using installer = await LexInstaller.load(options)

  await installer.install({ update: true })

  await installer.save()
}
