import { dirname, join, relative, resolve, sep } from 'node:path'
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
import type { LexiconsManifest } from './lexicons-manifest.js'
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

  /**
   * When `true`, forces re-fetching of lexicons from the network even if they
   * already exist locally. Useful for updating to newer versions.
   * @default false
   */
  update?: boolean
}

export type { LexResolverResult }
export type InstallResult = {
  lexicon: LexiconDocument
  /** The AT URI the lexicon was fetched from; absent for local-file installs. */
  uri?: AtUri
}

/**
 * How a root lexicon (explicit addition or restored manifest entry) should be
 * installed.
 */
type RootSource =
  /** Resolve from the given AT URI (network). */
  | { kind: 'uri'; uri: AtUri }
  /** Install (symlink) from an already-read local file. */
  | { kind: 'resolved'; source: ResolvedLexicon }
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
  protected readonly manifest: LexiconsManifest
  protected readonly originalManifest: LexiconsManifest
  protected readonly resolvers: readonly LexiconResolver[]

  constructor(
    protected readonly options: LexInstallerOptions,
    manifest?: LexiconsManifest,
  ) {
    this.manifest = structuredClone(manifest ?? EMPTY_MANIFEST)
    this.originalManifest = structuredClone(manifest ?? EMPTY_MANIFEST)
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
   * Compares the current manifest state with another manifest for equality.
   *
   * Both manifests are normalized before comparison to ensure consistent
   * ordering of entries. Useful for detecting changes during CI verification.
   *
   * @param manifest - The manifest to compare against
   * @returns `true` if the manifests are equivalent, `false` otherwise
   */
  isUnmodified(): boolean {
    return lexEquals(
      normalizeLexiconsManifest(this.originalManifest),
      normalizeLexiconsManifest(this.manifest),
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
   * @param options.additions - Iterable of lexicon identifiers to add.
   *   Can be NSID strings or AT URIs.
   * @param options.manifest - Existing manifest to use as a baseline.
   *   Previously resolved URIs are preserved unless explicitly overridden.
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
   * Install with existing manifest as hint:
   * ```typescript
   * const existingManifest = await readJsonFile('./lexicons.manifest.json')
   * await installer.install({
   *   additions: ['com.example.newLexicon'],
   *   manifest: existingManifest,
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
  }: {
    additions?: Iterable<string>
  } = {}): Promise<void> {
    const roots = new NsidMap<RootSource>()

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
    for (const lexicon of this.manifest.lexicons) {
      const nsid = NSID.from(lexicon)

      // Skip entries already added explicitly
      if (!roots.has(nsid)) {
        const resolution = this.manifest.resolutions[lexicon]
        const source = await this.restoreSource(resolution)

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

          const nsidStr = nsid.toString() as NsidString
          const resolution = this.manifest?.resolutions[nsidStr]
          const source = await this.restoreSource(resolution)
          const result = await this.installFromSource(nsid, source)
          installed.add(result.lexicon.id)
        }),
      )
    } while (results.length > 0)

    // Add newly installed root lexicons to the manifest if they are not already
    // present
    for (const id of installedRootIds) {
      if (!this.manifest.lexicons.includes(id)) {
        this.manifest.lexicons.push(id)
      }
    }

    // Finally, clear resolutions for lexicons that were not referenced
    for (const id of Object.keys(this.manifest.resolutions) as NsidString[]) {
      if (!installed.has(id)) {
        console.debug(`Removing resolution for unused lexicon: ${id}`)
        delete this.manifest.resolutions[id]
      }
    }
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
      return { nsid: NSID.from(uri.rkey), source: { kind: 'uri', uri } }
    }

    // Treat the argument as a local file path whenever it is a `file://` URI or
    // contains a slash. File paths are resolved relative to the CWD.
    if (addition.startsWith(FILE_URI_PREFIX) || addition.includes('/')) {
      const relPath = addition.startsWith(FILE_URI_PREFIX)
        ? addition.slice(FILE_URI_PREFIX.length)
        : addition
      const source = await readLexiconFile(resolve(process.cwd(), relPath))
      return {
        nsid: NSID.from(source.lexicon.id),
        source: { kind: 'resolved', source },
      }
    }

    return { nsid: NSID.from(addition), source: null }
  }

  /**
   * Resolves a locked resolution entry into a {@link RootSource}. Under
   * `--update`, pins are ignored so the resolver chain (and network) re-runs.
   */
  protected async restoreSource(
    resolution: { uri: string; cid: string } | undefined,
  ): Promise<RootSource> {
    if (this.options.update || !resolution) return null

    const { uri } = resolution
    if (uri.startsWith(FILE_URI_PREFIX)) {
      const path = resolve(this.manifestDir, uri.slice(FILE_URI_PREFIX.length))
      return { kind: 'resolved', source: await readLexiconFile(path) }
    }
    return { kind: 'uri', uri: new AtUri(uri) }
  }

  protected installFromSource(
    nsid: NSID,
    source: RootSource,
  ): Promise<InstallResult> {
    switch (source?.kind) {
      case 'uri':
        return this.installFromUri(source.uri)
      case 'resolved':
        return this.installFromResolved(nsid, source.source)
      default:
        return this.installFromNsid(nsid)
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

  protected async installFromNsid(nsid: NSID): Promise<InstallResult> {
    // Local override resolvers take precedence over the network fallback.
    for (const resolver of this.resolvers) {
      const resolved = await resolver.resolve(nsid)
      if (resolved) return this.installFromResolved(nsid, resolved)
    }

    const did = await this.lexiconResolver.resolve(nsid)
    return this.installFromDid(did, nsid)
  }

  protected async installFromResolved(
    nsid: NSID,
    resolved: ResolvedLexicon,
  ): Promise<InstallResult> {
    if (isAtUriString(resolved.uri)) {
      return this.installFromUri(new AtUri(resolved.uri))
    } else if (fileUriStringSchema.matches(resolved.uri)) {
      const { lexicon, cid, uri } = resolved
      if (lexicon.id !== nsid.toString()) {
        throw new Error(
          `NSID mismatch: expected ${nsid.toString()}, got ${lexicon.id}`,
        )
      }

      const path = uri.slice(FILE_URI_PREFIX.length)
      const destPath = `${join(this.options.lexicons, ...lexicon.id.split('.'))}.json`
      await symlinkLexicon(destPath, path)

      this.documents.set(nsid, lexicon)
      this.manifest.resolutions[lexicon.id] = {
        cid: cid.toString(),
        uri: `${FILE_URI_PREFIX}${relative(this.manifestDir, path).split(sep).join('/')}`,
      }

      return { lexicon }
    } else {
      throw new Error(`Unsupported URI scheme: ${resolved.uri}`)
    }
  }

  /**
   * @throws if the uri is not a valid AT URI pointing to a lexicon document.
   */
  protected async installFromUri(uri: AtUri): Promise<InstallResult> {
    if (uri.collection !== 'com.atproto.lexicon.schema') {
      throw new Error(`Invalid lexicon document uri: ${uri.toString()}`)
    }
    const did = uri.did
    const nsid = NSID.from(uri.rkey)
    return this.installFromDid(did, nsid)
  }

  protected async installFromDid(
    did: DidString,
    nsid: NSID,
  ): Promise<InstallResult> {
    const { lexicon, cid } = this.options.update
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

    if (lexicon.id !== nsid.toString()) {
      throw new Error(
        `NSID mismatch: expected ${nsid.toString()}, got ${lexicon.id}`,
      )
    }

    const uri = AtUri.make(did, 'com.atproto.lexicon.schema', nsid.toString())

    this.documents.set(nsid, lexicon)
    this.manifest.resolutions[lexicon.id] = {
      cid: cid.toString(),
      uri: uri.toString(),
    }

    return { lexicon, uri }
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
      noCache: this.options.update,
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
      normalizeLexiconsManifest(this.manifest),
    )
  }
}

function describeSource(source: RootSource): string {
  switch (source?.kind) {
    case 'uri':
      return source.uri.toString()
    case 'resolved':
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
