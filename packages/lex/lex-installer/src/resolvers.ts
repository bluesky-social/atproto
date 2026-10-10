import { statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { BuildFilterOptions, Filter } from '@atproto/lex-builder'
import { buildFilter } from '@atproto/lex-builder'
import type { AgentConfig } from '@atproto/lex-client'
import { Client } from '@atproto/lex-client'
import type { LexiconDocument } from '@atproto/lex-document'
import { lexiconDocumentSchema } from '@atproto/lex-document'
import {
  AtUri,
  LexResolver,
  type LexResolverOptions,
} from '@atproto/lex-resolver'
import {
  type AtIdentifierString,
  type AtUriString,
  type DidString,
  type NSID,
  isHandleIdentifier,
} from '@atproto/syntax'
import { createDidResolver, extractPdsUrl } from '@atproto-labs/did-resolver'
import type { CreateDidResolverOptions } from '@atproto-labs/did-resolver'
import type { HandleResolver } from '@atproto-labs/handle-resolver'
import {
  AtprotoHandleResolverNode,
  type AtprotoHandleResolverNodeOptions,
} from '@atproto-labs/handle-resolver-node'
import type { FileUriString } from './fs.js'
import { readLexiconDocument } from './lexicon-document.js'
import { com } from './lexicons/index.js'
import type { LexiconResolverConfig } from './lexicons-manifest.js'

/**
 * A lexicon document resolved from a local file, along with the information
 * needed to install (symlink) and lock it.
 */
export type ResolvedLexicon = {
  uri: AtUri | AtUriString | FileUriString
  lexicon: LexiconDocument
}

/**
 * A pluggable, local source for resolving a lexicon by its NSID. Resolvers are
 * consulted (in order) as overrides before the network fallback.
 *
 * @see {@link DirectoryResolver}
 */
export interface LexiconResolver {
  /**
   * @returns the resolved lexicon, or `null` if this resolver does not provide
   *   the given NSID (so the next resolver / network fallback can be tried).
   */
  resolve(nsid: NSID): Promise<ResolvedLexicon | null>
}

export class FilteredResolver implements LexiconResolver {
  protected readonly filter: Filter
  constructor(
    protected readonly resolver: LexiconResolver,
    options: BuildFilterOptions,
  ) {
    this.filter = buildFilter(options)
  }

  async resolve(nsid: NSID): Promise<ResolvedLexicon | null> {
    return this.filter(nsid.toString()) ? this.resolver.resolve(nsid) : null
  }

  static for(
    resolver: LexiconResolver,
    options?: BuildFilterOptions,
  ): LexiconResolver {
    if (options?.include == null && options?.exclude == null) return resolver
    return new FilteredResolver(resolver, options)
  }
}

/**
 * Resolves lexicons from a local directory laid out by NSID
 * (e.g. `app.bsky.feed.post` → `<dir>/app/bsky/feed/post.json`).
 *
 * An optional {@link Filter} gates which NSIDs this resolver answers for,
 * mirroring the include/exclude semantics of {@link buildFilter}.
 */
export class DirectoryResolver implements LexiconResolver {
  constructor(protected readonly directory: string) {
    // Throw if the directory does not exist (shows an invalid configuration
    // that could cause the wrong lexicons to be resolved)
    if (!statSync(directory).isDirectory()) {
      throw new Error(`Invalid directory: ${directory}`)
    }
  }

  async resolve(nsid: NSID): Promise<ResolvedLexicon | null> {
    // @NOTE this assumes that the directory is structured according to NSID
    // segments. We could expand this to use a more flexible mapping in the
    // future (e.g. by searching the directory for matching files).
    const path = resolve(`${join(this.directory, ...nsid.segments)}.json`)

    const lexicon = await readLexiconDocument(path)
    if (lexicon) return { uri: `file://${path}`, lexicon }

    // File not found
    return null
  }
}

type BuildClientOptions = BuildClientFromDidOptions &
  AtprotoHandleResolverNodeOptions & {
    handleResolver?: HandleResolver
  }

async function buildClient(
  repo: AtIdentifierString,
  options: BuildClientOptions,
) {
  if (isHandleIdentifier(repo)) {
    const handleResolver =
      options?.handleResolver ?? new AtprotoHandleResolverNode(options)
    const did = await handleResolver.resolve(repo)
    if (did) return buildClientFromDid(did, options)
    throw new Error(`Unable to resolve DID for handle: ${repo}`)
  }
  return buildClientFromDid(repo, options)
}

export type BuildClientFromDidOptions = CreateDidResolverOptions &
  Omit<AgentConfig, 'did' | 'service'>

async function buildClientFromDid(
  did: DidString,
  options: BuildClientOptions,
): Promise<Client> {
  const didResolver = createDidResolver(options)
  const document = await didResolver.resolve(did)
  const service = extractPdsUrl(document)
  return new Client({ service, did, fetch: options?.fetch })
}

export class RepoResolver implements LexiconResolver {
  constructor(protected readonly buildClient: () => Client | Promise<Client>) {}

  #clientPromise: Promise<Client> | undefined
  protected async initClient(): Promise<Client> {
    return (this.#clientPromise ??= Promise.resolve().then(this.buildClient))
  }

  /**
   * @note we never return "null" on 404/Not-found errors to prevent the
   * resolution from falling through the next resolver in the chain. Users are
   * expected to use include/exclude filters to control which NSIDs are resolved
   * in the defined repo.
   */
  async resolve(nsid: NSID): Promise<ResolvedLexicon> {
    const client = await this.initClient()

    const rkey = nsid.toString()

    const res = await client.get(com.atproto.lexicon.schema, { rkey })

    const lexicon = lexiconDocumentSchema.parse(res.value)
    const uri = AtUri.make(
      client.assertDid,
      com.atproto.lexicon.schema.$type,
      rkey,
    )

    return { uri, lexicon }
  }
}

export type CreateResolversOptions = LexResolverOptions &
  BuildClientOptions & {
    manifest: string
  }

/**
 * Builds the ordered list of local resolvers declared in the manifest's
 * `resolvers` array. Paths are resolved relative to `manifestDir` (the directory
 * containing the manifest file).
 */
export function createResolver(
  options: CreateResolversOptions,
  configs: Iterable<LexiconResolverConfig> = [],
): LexiconResolver {
  const lexResolver = new LexResolver(options)
  const resolvers = Array.from(configs, (config): LexiconResolver => {
    const resolver = buildCustomResolver(options, config)
    return FilteredResolver.for(resolver, config)
  })
  return {
    async resolve(nsid) {
      for (const resolver of resolvers) {
        const result = await resolver.resolve(nsid)
        if (result) return result
      }
      return lexResolver.get(nsid)
    },
  }
}

function buildCustomResolver(
  options: CreateResolversOptions,
  config: LexiconResolverConfig,
): LexiconResolver {
  switch (config.type) {
    case 'directory':
      return new DirectoryResolver(
        resolve(dirname(options.manifest), config.path),
      )
    case 'repo':
      return new RepoResolver(async () => {
        return buildClient(config.repo, options)
      })
    default:
      throw new Error(
        `Unsupported lexicon resolver type: ${(config as { type: string }).type}`,
      )
  }
}
