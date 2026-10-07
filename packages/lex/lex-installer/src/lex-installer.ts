import { dirname, join, resolve } from 'node:path'
import { cidForLex } from '@atproto/lex-cbor'
import { lexEquals } from '@atproto/lex-data'
import type { LexiconDocument } from '@atproto/lex-document'
import type { AtUriString, NsidString } from '@atproto/lex-schema'
import { type AtUri, NSID, isAtUriString } from '@atproto/syntax'
import {
  type FileUriString,
  fromFileUri,
  isEnoentError,
  isFileUriString,
  readJsonFile,
  resolveFileUri,
  symlinkLexicon,
  toRelativeFileUri,
  writeJsonFile,
} from './fs.js'
import {
  listDocumentNsidRefs,
  readLexiconDocument,
} from './lexicon-document.js'
import type {
  LexiconsManifestV1,
  LexiconsManifestV2,
  Resolution,
} from './lexicons-manifest.js'
import {
  lexiconsManifestSchema,
  normalizeManifest,
} from './lexicons-manifest.js'
import { NsidMap } from './nsid-map.js'
import { NsidSet } from './nsid-set.js'
import type { CreateResolversOptions, LexiconResolver } from './resolvers.js'
import { createResolver } from './resolvers.js'

/**
 * Configuration options for the {@link LexInstaller} class.
 *
 * Extends {@link LexResolverOptions} with paths for lexicon storage
 * and manifest management.
 *
 * @example
 * ```typescript
 * const options: LexInstallerOptions = {
 *   lexicons: './lexicons',
 *   manifest: './lexicons.manifest.json',
 *   update: false,
 * }
 * ```
 */
export type LexInstallerOptions = CreateResolversOptions & {
  /**
   * Path to the directory where lexicon JSON files will be stored.
   * The directory structure mirrors the NSID hierarchy
   * (e.g., 'app.bsky.feed.post' becomes 'app/bsky/feed/post.json').
   */
  lexicons: string

  /**
   * Path to the manifest file that tracks installed lexicons and their resolutions.
   */
  manifest: string
}

/**
 * Manages the installation of Lexicon schemas from the AT Protocol network.
 *
 * The `LexInstaller` class handles fetching, caching, and organizing lexicon
 * documents. It tracks dependencies between lexicons and ensures all referenced
 * schemas are installed. The class implements `AsyncDisposable` for proper
 * resource cleanup.
 *
 * @example
 * Basic usage with async disposal:
 * ```typescript
 * import { LexInstaller } from '@atproto/lex-installer'
 *
 * await using installer = new LexInstaller({
 *   lexicons: './lexicons',
 *   manifest: './lexicons.manifest.json',
 * })
 *
 * await installer.install({
 *   additions: ['app.bsky.feed.post'],
 * })
 *
 * await installer.save()
 * // Resources automatically cleaned up when block exits
 * ```
 *
 * @example
 * Manual disposal:
 * ```typescript
 * const installer = new LexInstaller({
 *   lexicons: './lexicons',
 *   manifest: './lexicons.manifest.json',
 * })
 *
 * try {
 *   await installer.install({ additions: ['app.bsky.actor.profile'] })
 *   await installer.save()
 * } finally {
 *   await installer[Symbol.asyncDispose]()
 * }
 * ```
 */
export class LexInstaller {
  static async load(options: LexInstallerOptions): Promise<LexInstaller> {
    const manifest = await readJsonFile(options.manifest)
      .then((json) => lexiconsManifestSchema.parse(json))
      .catch((cause: unknown) => {
        if (isEnoentError(cause)) return undefined
        throw new Error('Failed to read lexicons manifest', { cause })
      })

    return new LexInstaller(options, manifest)
  }

  protected readonly workingLexicons = new NsidMap<LexiconDocument>()
  protected readonly workingManifest: LexiconsManifestV2
  protected readonly originalManifest: LexiconsManifestV2 | null
  protected readonly resolver: LexiconResolver

  constructor(
    protected readonly options: LexInstallerOptions,
    manifest: LexiconsManifestV1 | LexiconsManifestV2 | undefined = undefined,
  ) {
    this.workingManifest = normalizeManifest(manifest)
    this.originalManifest = manifest ? normalizeManifest(manifest) : null
    this.resolver = createResolver(options, this.workingManifest.resolvers)
  }

  /**
   * Whether installation left the manifest equivalent to the one loaded from
   * disk. Both are normalized before comparison so entry ordering is irrelevant.
   * Used by `--ci` to detect drift.
   *
   * Returns `false` when no manifest file existed to begin with: a missing
   * lockfile is drift to report, not an unchanged state.
   *
   * @returns `true` if a baseline manifest existed and still matches the current
   *   state, `false` otherwise
   */
  requiresSave(): boolean {
    if (this.originalManifest == null) return true
    return !lexEquals(
      normalizeManifest(this.originalManifest),
      normalizeManifest(this.workingManifest),
    )
  }

  /**
   * Installs lexicons and their dependencies.
   *
   * This method processes explicit additions and restores entries from an
   * existing manifest. It recursively resolves and installs all referenced
   * lexicons to ensure complete dependency trees.
   *
   * @param options - Installation options
   * @param options.additions - Iterable of lexicon identifiers to add. Can be
   *   NSID strings, AT URIs, or local file paths / `file://` URIs.
   *
   * @example
   * Install new lexicons:
   * ```typescript
   * await installer.install({
   *   additions: ['app.bsky.feed.post', 'app.bsky.actor.profile'],
   * })
   * ```
   *
   * @example
   * Install from specific AT URIs:
   * ```typescript
   * await installer.install({
   *   additions: [
   *     'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post',
   *   ],
   * })
   * ```
   */
  async install({
    additions,
    update = false,
  }: {
    additions?: Iterable<string>
    update?: boolean
  } = {}): Promise<void> {
    const roots = new NsidMap<{ update: boolean }>()

    // First, process explicit additions
    if (additions) {
      for (const addition of additions) {
        try {
          const nsid = NSID.from(addition)

          if (!roots.has(nsid)) {
            roots.set(nsid, {
              // Force a fresh installation of explicitly added lexicons
              update: true,
            })
          }
        } catch (cause) {
          throw new Error(`Failed to process "${addition}"`, { cause })
        }
      }
    }

    // Next, restore previously existing manifest entries
    for (const lexicon of this.workingManifest.lexicons) {
      const nsid = NSID.from(lexicon)

      // Skip entries already added explicitly
      if (!roots.has(nsid)) {
        roots.set(nsid, {
          // Force an update of previously existing lexicons only when the
          // `update` option is true
          update,
        })
      }
    }

    // Install all root lexicons (and store them in the manifest)
    const installedRootIds = await Promise.all(
      Array.from(roots, async ([nsid, { update }]) => {
        await this.addLexicon(nsid, update)
        return nsid.toString()
      }),
    )

    const installed = new Set<NsidString>(installedRootIds)

    // Then recursively install all referenced lexicons
    let results: unknown[]
    do {
      results = await Promise.all(
        Array.from(this.getMissingIds(), async (nsid) => {
          await this.addLexicon(nsid, update)
          installed.add(nsid.toString())
        }),
      )
    } while (results.length > 0)

    // Add newly installed root lexicons to the manifest if they are not already
    // present
    for (const id of installedRootIds) {
      if (!this.workingManifest.lexicons.includes(id)) {
        this.workingManifest.lexicons.push(id)
      }
    }

    // Finally, clear resolutions for lexicons that were not referenced
    for (const id of Object.keys(
      this.workingManifest.resolutions,
    ) as NsidString[]) {
      if (!installed.has(id)) {
        delete this.workingManifest.resolutions[id]
      }
    }

    // @TODO should we clean the lexiconDirPath of files that are not referenced
    // in the manifest?
  }

  public update() {
    return this.install({ update: true })
  }

  protected getResolution(nsid: NsidString | NSID): Resolution | null {
    const nsidStr = typeof nsid === 'string' ? nsid : nsid.toString()
    const resolution = Object.hasOwn(this.workingManifest.resolutions, nsidStr)
      ? (this.workingManifest.resolutions[nsidStr] ?? null)
      : null
    return resolution
  }

  protected async addDocument(
    nsid: NSID,
    {
      uri,
      lexicon,
    }: {
      uri: FileUriString | AtUri | AtUriString
      lexicon: LexiconDocument
    },
  ): Promise<void> {
    if (nsid.toString() !== lexicon.id) {
      throw new Error(
        `NSID mismatch: expected ${nsid.toString()}, got ${lexicon.id}`,
      )
    }

    const cid = await cidForLex(lexicon)

    this.workingLexicons.set(nsid, lexicon)
    this.workingManifest.resolutions[lexicon.id] = {
      cid: cid.toString(),
      uri: isFileUriString(uri)
        ? // Store file uris relative to the manifest directory. Anchor the
          // (possibly already-relative) uri to that directory first, so the
          // locked value never depends on process.cwd().
          toRelativeFileUri(this.manifestDirPath, uri)
        : typeof uri === 'string'
          ? uri // AtUriString
          : uri.toString(), // AtUri
    }
  }

  get lexiconsDirPath(): string {
    return resolve(this.options.lexicons)
  }

  get manifestDirPath(): string {
    return resolve(dirname(this.options.manifest))
  }

  protected async addLexicon(nsid: NSID, update: boolean): Promise<void> {
    const path = `${join(this.lexiconsDirPath, ...nsid.segments)}.json`

    // Existing lock entry, if any. Ignored in `update` mode, where we always
    // re-resolve from scratch.
    const resolution = update ? null : this.getResolution(nsid)

    // Try to re-use the existing lexicon file from the lexicons folder, in
    // order to avoid re-downloading it if it already exists locally.
    if (resolution) {
      if (!isAtUriString(resolution.uri)) {
        // Ensure that, if the resolution is a file URI, the source file
        // exists and is correctly linked. File uris are locked relative to the
        // manifest *directory*, so resolve them against that (not the manifest
        // file path, which would land one level too deep).
        const sourcePath = resolveFileUri(this.manifestDirPath, resolution.uri)
        await symlinkLexicon(path, sourcePath)
      }

      const lexicon = await readLexiconDocument(path)

      if (lexicon?.id === nsid.toString()) {
        return this.addDocument(nsid, {
          uri: resolution.uri,
          lexicon,
        })
      }
    }

    const result = await this.resolver.resolve(nsid)
    if (!result) {
      throw new Error(`Unable to resolve lexicon for NSID: ${nsid}`)
    }

    // @NOTE If a resolve entry existed but its file was missing (or no longer
    // matched), we re-resolved. Re-resolution goes through NSID discovery,
    // which can reach a different source (even a different DID) than the one
    // originally locked. This will be surfaced as a new resolution in the
    // manifest.

    if (isFileUriString(result.uri)) {
      const sourcePath = fromFileUri(result.uri)

      // Link the lexicon file at its right place
      await symlinkLexicon(path, sourcePath)

      return this.addDocument(nsid, result)
    } else {
      // Write the file at it's destination path
      await writeJsonFile(path, result.lexicon)

      return this.addDocument(nsid, result)
    }
  }

  protected getMissingIds(): NsidSet {
    const missing = new NsidSet()

    for (const document of this.workingLexicons.values()) {
      for (const nsid of listDocumentNsidRefs(document)) {
        if (!this.workingLexicons.has(nsid)) {
          missing.add(nsid)
        }
      }
    }

    return missing
  }

  /**
   * Saves the current manifest to disk.
   *
   * The manifest is normalized before saving to ensure consistent ordering
   * of entries, making it suitable for version control.
   */
  async save(): Promise<void> {
    // @TODO use prettier to format the JSON before writing to disk
    await writeJsonFile(
      this.options.manifest,
      normalizeManifest(this.workingManifest),
    )
  }
}
