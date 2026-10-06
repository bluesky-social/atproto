import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LexiconDirectoryIndexer } from '@atproto/lex-builder'
import { cidForLex } from '@atproto/lex-cbor'
import { lexEquals } from '@atproto/lex-data'
import type {
  LexiconDocument,
  LexiconParameters,
  LexiconPermission,
  LexiconRef,
  LexiconRefUnion,
  LexiconUnknown,
  MainLexiconDefinition,
  NamedLexiconDefinition,
} from '@atproto/lex-document'
import type {
  LexResolverOptions,
  LexResolverResult,
} from '@atproto/lex-resolver'
import { LexResolver } from '@atproto/lex-resolver'
import {
  type DidString,
  type NsidString,
  isAtUriString,
} from '@atproto/lex-schema'
import { AtUri, NSID } from '@atproto/syntax'
import {
  isEnoentError,
  readJsonFile,
  symlinkLexicon,
  writeJsonFile,
} from './fs.js'
import type {
  FileUriString,
  LexiconsManifest,
  Resolution,
} from './lexicons-manifest.js'
import {
  fileUriStringSchema,
  lexiconsManifestSchema,
  normalizeLexiconsManifest,
} from './lexicons-manifest.js'
import { NsidMap } from './nsid-map.js'
import { NsidSet } from './nsid-set.js'
import type { LexiconResolver, ResolvedLexicon } from './resolvers.js'
import { createResolvers, readLexiconFile } from './resolvers.js'

const FILE_URI_PREFIX = 'file://'
const AT_URI_PREFIX = 'at://'

const EMPTY_MANIFEST: LexiconsManifest = {
  version: 1,
  lexicons: [],
  resolutions: {},
}

/**
 * Resolves a positional `install` argument that denotes a local file into a
 * filesystem path. Supports a plain path, the project's nonstandard relative
 * `file://` shorthand (`file://./x`, `file://../x`), and genuine RFC 8089 file
 * URLs (percent-decoded, absolute `file:///x`, …) via `fileURLToPath`.
 */
function fileArgToPath(addition: string): string {
  if (!addition.startsWith(FILE_URI_PREFIX)) return addition
  if (
    // Absolute
    addition.startsWith('file:///') ||
    // Relative file URL
    addition.startsWith('file://./') ||
    addition.startsWith('file://../')
  ) {
    return addition.slice(FILE_URI_PREFIX.length)
  }
  return fileURLToPath(addition)
}

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
export type LexInstallerOptions = LexResolverOptions & {
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

export type { LexResolverResult }
export type InstallResult = {
  lexicon: LexiconDocument
}

/**
 * How a root lexicon (explicit addition or restored manifest entry) should be
 * installed.
 */
type RootSource =
  /** Resolve from the given AT URI (network). */
  | { kind: 'at-uri'; uri: AtUri }
  /** Install (symlink) from an already-read local file. */
  | { kind: 'file'; source: ResolvedLexicon<FileUriString> }
  /** Resolve from the NSID: local resolvers first, then network. */
  | null

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
export class LexInstaller implements AsyncDisposable {
  static async load(options: LexInstallerOptions): Promise<LexInstaller> {
    const manifest: LexiconsManifest | undefined = await readJsonFile(
      options.manifest,
    ).then(
      (json) => lexiconsManifestSchema.parse(json),
      (cause: unknown) => {
        if (isEnoentError(cause)) return undefined
        throw new Error('Failed to read lexicons manifest', { cause })
      },
    )

    return new LexInstaller(options, manifest)
  }

  protected readonly lexiconResolver: LexResolver
  protected readonly indexer: LexiconDirectoryIndexer
  protected readonly documents = new NsidMap<LexiconDocument>()
  protected readonly workingManifest: LexiconsManifest
  protected readonly originalManifest: LexiconsManifest | undefined
  protected readonly resolvers: readonly LexiconResolver[]

  constructor(
    protected readonly options: LexInstallerOptions,
    manifest?: LexiconsManifest,
  ) {
    this.workingManifest = structuredClone(manifest ?? EMPTY_MANIFEST)
    this.originalManifest = manifest ? structuredClone(manifest) : undefined
    this.lexiconResolver = new LexResolver(options)
    this.indexer = new LexiconDirectoryIndexer({
      lexicons: options.lexicons,
    })
    this.resolvers = createResolvers(manifest?.resolvers, this.manifestDir)
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.indexer[Symbol.asyncDispose]()
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
  isUnmodified(): boolean {
    return (
      this.originalManifest !== undefined &&
      lexEquals(
        normalizeLexiconsManifest(this.originalManifest),
        normalizeLexiconsManifest(this.workingManifest),
      )
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
    const roots = new NsidMap<RootSource>()
    const useResolutions = !update

    // First, process explicit additions
    for (const addition of new Set(additions)) {
      const { nsid, source } = await this.parseAddition(addition)

      if (roots.has(nsid)) {
        throw new Error(`Duplicate lexicon addition: ${nsid}`)
      }

      roots.set(nsid, source)
      console.debug(`Adding new lexicon: ${nsid} (${describeSource(source)})`)
    }

    // Next, restore previously existing manifest entries
    for (const lexicon of this.workingManifest.lexicons) {
      const nsid = NSID.from(lexicon)

      // Skip entries already added explicitly
      if (!roots.has(nsid)) {
        const source = useResolutions
          ? await this.restoreResolution(nsid)
          : null

        roots.set(nsid, source)
        console.debug(
          `Adding lexicon from manifest: ${nsid} (${describeSource(source)})`,
        )
      }
    }

    // Install all root lexicons (and store them in the manifest)
    const installedRootIds = await Promise.all(
      Array.from(roots, async ([nsid, source]) => {
        console.debug(`Installing lexicon: ${nsid}`)

        const { lexicon: document } = await this.installFromSource(nsid, source)

        return document.id
      }),
    )

    const installed = new Set<NsidString>(installedRootIds)

    // Then recursively install all referenced lexicons
    let results: unknown[]
    do {
      results = await Promise.all(
        Array.from(this.getMissingIds(), async (nsid) => {
          console.debug(`Resolving dependency lexicon: ${nsid}`)

          const source = useResolutions
            ? await this.restoreResolution(nsid)
            : null
          const result = await this.installFromSource(nsid, source)
          installed.add(result.lexicon.id)
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
        console.debug(`Removing resolution for unused lexicon: ${id}`)
        delete this.workingManifest.resolutions[id]
      }
    }
  }

  public update() {
    return this.install({ update: true })
  }

  protected getResolution(id: NsidString | NSID): Resolution | null {
    const nsid = NSID.from(id).toString()
    const resolution = Object.hasOwn(this.workingManifest.resolutions, nsid)
      ? (this.workingManifest.resolutions[nsid] ?? null)
      : null
    return resolution
  }

  protected addDocument(
    nsid: NSID,
    lexicon: LexiconDocument,
    resolution: Resolution,
  ): void {
    if (nsid.toString() !== lexicon.id) {
      throw new Error(
        `NSID mismatch: expected ${nsid.toString()}, got ${lexicon.id}`,
      )
    }

    this.documents.set(nsid, lexicon)
    this.workingManifest.resolutions[lexicon.id] = resolution
  }

  /** Directory containing the manifest, used to resolve `file://` lock URIs. */
  protected get manifestDir(): string {
    return dirname(this.options.manifest)
  }

  /** Parses a CLI addition into an NSID and the source to install it from. */
  protected async parseAddition(
    addition: string,
  ): Promise<{ nsid: NSID; source: RootSource }> {
    if (addition.startsWith(AT_URI_PREFIX)) {
      const uri = new AtUri(addition)
      return {
        nsid: NSID.from(uri.rkey),
        source: { kind: 'at-uri', uri },
      }
    }

    // Treat the argument as a local file path whenever it is a `file://` URI or
    // contains a slash. File paths are resolved relative to the CWD.
    if (addition.startsWith(FILE_URI_PREFIX) || addition.includes('/')) {
      const relPath = fileArgToPath(addition)
      const source = await readLexiconFile(resolve(process.cwd(), relPath))
      return {
        nsid: NSID.from(source.lexicon.id),
        source: { kind: 'file', source },
      }
    }

    return {
      nsid: NSID.from(addition),
      source: null,
    }
  }

  /**
   * Resolves a locked resolution entry into a {@link RootSource}. Under
   * `--update`, pins are ignored so the resolver chain (and network) re-runs.
   */
  protected async restoreResolution(nsid: NSID): Promise<RootSource> {
    const resolution = this.getResolution(nsid)
    if (!resolution) return null

    const { uri } = resolution
    if (uri.startsWith(FILE_URI_PREFIX)) {
      const path = resolve(this.manifestDir, uri.slice(FILE_URI_PREFIX.length))
      const source = await readLexiconFile(path)
      return { kind: 'file', source }
    }

    return { kind: 'at-uri', uri: new AtUri(uri) }
  }

  protected installFromSource(
    nsid: NSID,
    source: RootSource,
    update?: boolean,
  ): Promise<InstallResult> {
    switch (source?.kind) {
      case 'file':
        return this.installFromResolved(nsid, source.source)
      case 'at-uri':
        return this.installFromUri(source.uri, update)
      default:
        return this.installFromNsid(nsid, update)
    }
  }

  protected getMissingIds(): NsidSet {
    const missing = new NsidSet()

    for (const document of this.documents.values()) {
      for (const nsid of listDocumentNsidRefs(document)) {
        if (!this.documents.has(nsid)) {
          missing.add(nsid)
        }
      }
    }

    return missing
  }

  protected async installFromNsid(
    nsid: NSID,
    update?: boolean,
  ): Promise<InstallResult> {
    // Local override resolvers take precedence over the network fallback.
    for (const resolver of this.resolvers) {
      const resolved = await resolver.resolve(nsid)
      if (resolved) return this.installFromResolved(nsid, resolved)
    }

    const did = await this.lexiconResolver.resolve(nsid)
    return this.installFromDid(did, nsid, update)
  }

  protected async installFromResolved(
    nsid: NSID,
    resolved: ResolvedLexicon,
  ): Promise<InstallResult> {
    if (isAtUriString(resolved.uri)) {
      return this.installFromUri(new AtUri(resolved.uri))
    } else if (fileUriStringSchema.matches(resolved.uri)) {
      const { lexicon, cid, uri } = resolved

      const path = resolve(uri.slice(FILE_URI_PREFIX.length))
      const lexicons = resolve(this.options.lexicons)
      // Link the lexicon file into the lexicons directory if it's not already
      // there.
      if (!path.startsWith(lexicons)) {
        const destPath = `${join(lexicons, ...lexicon.id.split('.'))}.json`
        await symlinkLexicon(destPath, path)
      }

      this.addDocument(nsid, lexicon, {
        cid: cid.toString(),
        uri: `${FILE_URI_PREFIX}${relative(this.manifestDir, path).split(sep).join('/')}`,
      })

      return { lexicon }
    } else {
      // Should never happen
      throw new Error(`Unsupported URI: ${resolved.uri}`)
    }
  }

  /**
   * @throws if the uri is not a valid AT URI pointing to a lexicon document.
   */
  protected async installFromUri(
    uri: AtUri,
    update?: boolean,
  ): Promise<InstallResult> {
    if (uri.collection !== 'com.atproto.lexicon.schema') {
      throw new Error(`Invalid lexicon document uri: ${uri.toString()}`)
    }
    const did = uri.did
    const nsid = NSID.from(uri.rkey)
    return this.installFromDid(did, nsid, update)
  }

  protected async installFromDid(
    did: DidString,
    nsid: NSID,
    update?: boolean,
  ): Promise<InstallResult> {
    const { lexicon, cid } = update
      ? await this.fetch(did, nsid)
      : await this.indexer
          .get(nsid)
          .then(async (lexicon) => {
            const cid = await cidForLex(lexicon)
            console.debug(`Re-using existing lexicon ${nsid} from indexer`)
            return { cid, lexicon }
          })
          .catch((err) => {
            if (isEnoentError(err)) return this.fetch(did, nsid)
            throw err
          })

    const uri = AtUri.make(did, 'com.atproto.lexicon.schema', nsid.toString())

    this.addDocument(nsid, lexicon, {
      cid: cid.toString(),
      uri: uri.toString(),
    })

    return { lexicon }
  }

  /**
   * Fetches a lexicon document from the network and saves it locally.
   *
   * The lexicon is retrieved from the specified AT URI, written to the
   * local lexicons directory, and its metadata is recorded for the manifest.
   *
   * @param uri - The AT URI pointing to the lexicon document
   * @returns An object containing the fetched lexicon document and its CID
   */
  protected async fetch(
    did: DidString,
    nsid: NSID,
  ): Promise<LexResolverResult> {
    console.debug(`Fetching lexicon ${nsid} from repo ${did}...`)

    const result = await this.lexiconResolver.fetch(did, nsid, {
      noCache: true,
    })

    const { lexicon } = result
    const basePath = join(this.options.lexicons, ...lexicon.id.split('.'))
    await writeJsonFile(`${basePath}.json`, lexicon)

    return result
  }

  /**
   * Saves the current manifest to disk.
   *
   * The manifest is normalized before saving to ensure consistent ordering
   * of entries, making it suitable for version control.
   */
  async save(): Promise<void> {
    await writeJsonFile(
      this.options.manifest,
      normalizeLexiconsManifest(this.workingManifest),
    )
  }
}

function describeSource(source: RootSource): string {
  switch (source?.kind) {
    case 'at-uri':
      return source.uri.toString()
    case 'file':
      return source.source.uri
    default:
      return 'from NSID'
  }
}

function* listDocumentNsidRefs(doc: LexiconDocument): Iterable<NSID> {
  try {
    for (const def of Object.values(doc.defs)) {
      if (def) {
        for (const ref of defRefs(def)) {
          const [nsid] = ref.split('#', 1)
          if (nsid) yield NSID.from(nsid)
        }
      }
    }
  } catch (cause) {
    throw new Error(`Failed to extract refs from lexicon ${doc.id}`, { cause })
  }
}

function* defRefs(
  def:
    | MainLexiconDefinition
    | NamedLexiconDefinition
    | LexiconPermission
    | LexiconUnknown
    | LexiconParameters
    | LexiconRef
    | LexiconRefUnion,
): Iterable<string> {
  switch (def.type) {
    case 'string':
      if (def.knownValues) {
        for (const val of def.knownValues) {
          // Tokens ?
          const { length, 0: nsid, 1: hash } = val.split('#')
          if (length === 2 && hash) {
            try {
              NSID.from(nsid)
              yield val
            } catch {
              // ignore invalid nsid
            }
          }
        }
      }
      return
    case 'array':
      return yield* defRefs(def.items)
    case 'params':
    case 'object':
      for (const prop of Object.values(def.properties)) {
        yield* defRefs(prop)
      }
      return
    case 'union':
      yield* def.refs
      return
    case 'ref': {
      yield def.ref
      return
    }
    case 'record':
      yield* defRefs(def.record)
      return
    case 'procedure':
      if (def.input?.schema) {
        yield* defRefs(def.input.schema)
      }
    // fallthrough
    case 'query':
      if (def.output?.schema) {
        yield* defRefs(def.output.schema)
      }
    // fallthrough
    case 'subscription':
      if (def.parameters) {
        yield* defRefs(def.parameters)
      }
      if ('message' in def && def.message?.schema) {
        yield* defRefs(def.message.schema)
      }
      return
    case 'permission-set':
      for (const permission of def.permissions) {
        yield* defRefs(permission)
      }
      return
    case 'permission':
      if (def.resource === 'rpc') {
        if (Array.isArray(def.lxm)) {
          for (const lxm of def.lxm) {
            if (typeof lxm === 'string') {
              yield lxm
            }
          }
        }
      } else if (def.resource === 'repo') {
        if (Array.isArray(def.collection)) {
          for (const lxm of def.collection) {
            if (typeof lxm === 'string') {
              yield lxm
            }
          }
        }
      }
      return
    case 'boolean':
    case 'cid-link':
    case 'token':
    case 'bytes':
    case 'blob':
    case 'integer':
    case 'unknown':
      // @NOTE We explicitly list all types here to ensure exhaustiveness
      // causing TS to error if a new type is added without updating this switch
      return
    default:
      // @ts-expect-error
      throw new Error(`Unknown lexicon def type: ${def.type}`)
  }
}
