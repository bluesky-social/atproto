import { join } from 'node:path'
import { LexiconDirectoryIndexer } from '@atproto/lex-builder'
import { cidForLex } from '@atproto/lex-cbor'
import { Cid, lexEquals } from '@atproto/lex-data'
import {
  LexiconDocument,
  LexiconParameters,
  LexiconPermission,
  LexiconRef,
  LexiconRefUnion,
  LexiconUnknown,
  MainLexiconDefinition,
  NamedLexiconDefinition,
} from '@atproto/lex-document'
import { LexResolver, LexResolverOptions } from '@atproto/lex-resolver'
import { AtUriString, NsidString } from '@atproto/lex-schema'
import { AtUri, NSID } from '@atproto/syntax'
import { isEnoentError, writeJsonFile } from './fs.js'
import {
  LexiconsManifest,
  normalizeLexiconsManifest,
} from './lexicons-manifest.js'
import { NsidMap } from './nsid-map.js'
import { NsidSet } from './nsid-set.js'

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
  protected readonly lexiconResolver: LexResolver
  protected readonly indexer: LexiconDirectoryIndexer
  protected readonly documents = new NsidMap<LexiconDocument>()
  protected readonly manifest: LexiconsManifest = {
    version: 1,
    lexicons: [],
    resolutions: {},
  }

  constructor(protected readonly options: LexInstallerOptions) {
    this.lexiconResolver = new LexResolver(options)
    this.indexer = new LexiconDirectoryIndexer({
      lexicons: options.lexicons,
    })
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
  equals(manifest: LexiconsManifest): boolean {
    return lexEquals(
      normalizeLexiconsManifest(manifest),
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
    manifest,
  }: {
    additions?: Iterable<string>
    manifest?: LexiconsManifest
  } = {}): Promise<void> {
    const roots = new NsidMap<AtUri | null>()

    // First, process explicit additions
    for (const lexicon of new Set(additions)) {
      const [nsid, uri]: [NSID, AtUri | null] = lexicon.startsWith('at://')
        ? ((uri) => [NSID.from(uri.rkey), uri])(new AtUri(lexicon))
        : [NSID.from(lexicon), null]

      if (roots.has(nsid)) {
        throw new Error(
          `Duplicate lexicon addition: ${nsid} (${roots.get(nsid) ?? lexicon})`,
        )
      }

      roots.set(nsid, uri)
      console.debug(`Adding new lexicon: ${nsid} (${uri ?? 'from NSID'})`)
    }

    // Next, restore previously existing manifest entries
    if (manifest) {
      for (const lexicon of manifest.lexicons) {
        const nsid = NSID.from(lexicon)

        // Skip entries already added explicitly
        if (!roots.has(nsid)) {
          const uri = manifest.resolutions[lexicon]
            ? new AtUri(manifest.resolutions[lexicon].uri)
            : null

          roots.set(nsid, uri)

          console.debug(
            `Adding lexicon from manifest: ${nsid} (${uri ?? 'from NSID'})`,
          )
        }
      }
    }

    // Install all root lexicons (and store them in the manifest)
    await Promise.all(
      Array.from(roots, async ([nsid, sourceUri]) => {
        console.debug(`Installing lexicon: ${nsid}`)

        const { lexicon: document } = sourceUri
          ? await this.installFromUri(sourceUri)
          : await this.installFromNsid(nsid)

        // Store the direct reference in the new manifest
        this.manifest.lexicons.push(document.id)
      }),
    )

    // Then recursively install all referenced lexicons
    let results: unknown[]
    do {
      results = await Promise.all(
        Array.from(this.getMissingIds(), async (nsid) => {
          console.debug(`Resolving dependency lexicon: ${nsid}`)

          const nsidStr = nsid.toString() as NsidString
          const resolvedUri = manifest?.resolutions[nsidStr]?.uri
            ? new AtUri(manifest.resolutions[nsidStr].uri)
            : null
          if (resolvedUri) {
            await this.installFromUri(resolvedUri)
          } else {
            await this.installFromNsid(nsid)
          }
        }),
      )
    } while (results.length > 0)
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

  protected async installFromNsid(nsid: NSID) {
    const uri = await this.lexiconResolver.resolve(nsid)
    return this.installFromUri(uri)
  }

  protected async installFromUri(uri: AtUri): Promise<{
    lexicon: LexiconDocument
    uri: AtUri
  }> {
    const { lexicon, cid } = this.options.update
      ? await this.fetch(uri)
      : await this.indexer.get(uri.rkey).then(
          async (lexicon) => {
            console.debug(`Re-using existing lexicon ${uri.rkey} from indexer`)
            const cid = await cidForLex(lexicon)
            return { cid, lexicon }
          },
          (err) => {
            if (isEnoentError(err)) return this.fetch(uri)
            throw err
          },
        )

    this.documents.set(NSID.from(lexicon.id), lexicon)
    this.manifest.resolutions[lexicon.id] = {
      cid: cid.toString(),
      uri: uri.toString() as AtUriString,
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
  async fetch(uri: AtUri): Promise<{ lexicon: LexiconDocument; cid: Cid }> {
    console.debug(`Fetching lexicon from ${uri}...`)

    const { lexicon, cid } = await this.lexiconResolver.fetch(uri, {
      noCache: this.options.update,
    })

    const basePath = join(this.options.lexicons, ...lexicon.id.split('.'))
    await writeJsonFile(`${basePath}.json`, lexicon)

    return { lexicon, cid }
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
