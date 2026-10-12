import { statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { BuildFilterOptions, Filter } from '@atproto/lex-builder'
import { buildFilter } from '@atproto/lex-builder'
import type { AgentConfig } from '@atproto/lex-client'
import { Client, XrpcResponseError } from '@atproto/lex-client'
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
import {
  DEFAULT_FORBIDDEN_DOMAIN_NAMES,
  type Fetch,
  safeFetchWrap,
} from '@atproto-labs/fetch-node'
import type { HandleResolver } from '@atproto-labs/handle-resolver'
import {
  AtprotoHandleResolverNode,
  type AtprotoHandleResolverNodeOptions,
} from '@atproto-labs/handle-resolver-node'
import type { FileUriString } from './fs.js'
import { readLexiconDocument } from './lexicon-document.js'
import { com } from './lexicons/index.js'
import type {
  HttpUrlString,
  LexiconResolverConfig,
} from './lexicons-manifest.js'

/**
 * A lexicon document resolved from a local file, along with the information
 * needed to install (symlink) and lock it.
 */
export type ResolvedLexicon = {
  uri: AtUri | AtUriString | FileUriString | HttpUrlString
  lexicon: LexiconDocument
}

interface PartialLexiconResolver {
  /**
   * @returns the resolved lexicon, or `null` if this resolver does not provide
   *   the given NSID (so the next resolver / network fallback can be tried).
   */
  resolve(nsid: NSID): Promise<ResolvedLexicon | null>
}

export class FilteredResolver implements PartialLexiconResolver {
  protected readonly filter: Filter
  protected readonly hasInclude: boolean

  constructor(
    protected readonly resolver: PartialLexiconResolver,
    options: BuildFilterOptions,
  ) {
    this.hasInclude = options?.include != null
    this.filter = buildFilter(options)
  }

  async resolve(nsid: NSID): Promise<ResolvedLexicon | null> {
    if (!this.filter(nsid.toString())) return null

    const result = await this.resolver.resolve(nsid)
    if (result) return result

    // Every resolver that has an explicit "include" list must resolve the NSID,
    // otherwise throw an error.
    if (this.hasInclude) {
      throw new Error(`NSID ${nsid.toString()} not resolved`)
    }

    return null
  }

  static for(
    resolver: PartialLexiconResolver,
    options?: BuildFilterOptions,
  ): PartialLexiconResolver {
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
export class DirectoryResolver implements PartialLexiconResolver {
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

export class RepoResolver implements PartialLexiconResolver {
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
  async resolve(nsid: NSID): Promise<ResolvedLexicon | null> {
    const client = await this.initClient()

    const rkey = nsid.toString()

    try {
      const res = await client.get(com.atproto.lexicon.schema, { rkey })

      const lexicon = lexiconDocumentSchema.parse(res.value)
      const uri = AtUri.make(
        client.assertDid,
        com.atproto.lexicon.schema.$type,
        rkey,
      )

      return { uri, lexicon }
    } catch (err) {
      if (err instanceof XrpcResponseError && err.error === 'RecordNotFound') {
        return null
      }

      throw err
    }
  }
}

/**
 * Resolves lexicons from a web server laid out by NSID
 * (e.g. `app.bsky.feed.post` → `<base>/app/bsky/feed/post.json`).
 *
 * `base` should be an `http(s)` URL; a trailing slash is optional. The `fetch`
 * is expected to be SSRF-safe (see {@link createResolver}) and to bound the
 * response size, so the (externally-sourced) body can be buffered safely.
 */
export class HttpResolver implements PartialLexiconResolver {
  protected readonly base: HttpUrlString
  constructor(
    base: HttpUrlString,
    protected readonly fetch: Fetch = globalThis.fetch,
  ) {
    // Normalize to a directory URL so NSID-relative paths join correctly
    // regardless of whether the configured base carried a trailing slash.
    this.base = base.endsWith('/') ? base : `${base}/`
  }

  /**
   * @returns `null` on a 404 (the base does not host this NSID), letting the
   * next resolver / network fallback try. Any other non-ok status throws, since
   * it signals a misconfigured or broken base rather than a plain miss.
   */
  async resolve(nsid: NSID): Promise<null | ResolvedLexicon> {
    const url = new URL(`${nsid.segments.join('/')}.json`, this.base)

    const response = await this.fetch.call(null, url.href, {
      redirect: 'error',
    })

    if (response.status === 404) {
      await response.body?.cancel?.()
      return null
    }

    if (!response.ok) {
      await response.body?.cancel?.()
      throw new Error(
        `Failed to fetch lexicon ${nsid} from ${url.href}: HTTP ${response.status}`,
      )
    }

    const lexicon = lexiconDocumentSchema.parse(await response.json())

    return { uri: url.href as HttpUrlString, lexicon }
  }
}

export type CreateResolversOptions = LexResolverOptions &
  BuildClientOptions & {
    manifest: string
  }

export class LexiconResolver {
  protected readonly lexResolver: LexResolver
  protected readonly resolvers: PartialLexiconResolver[]

  constructor(
    {
      fetch = safeFetchWrap({
        allowHttp: false,
        allowIpHost: false,
        ssrfProtection: true,
        forbiddenDomainNames: [...DEFAULT_FORBIDDEN_DOMAIN_NAMES, '*.internal'],
      }),
      ...opts
    }: CreateResolversOptions,
    configs: Iterable<LexiconResolverConfig> = [],
  ) {
    const options: CreateResolversOptions = { ...opts, fetch }
    this.lexResolver = new LexResolver(options)
    this.resolvers = Array.from(configs, (config): PartialLexiconResolver => {
      const resolver = buildPartialResolver(options, config)
      return FilteredResolver.for(resolver, config)
    })
  }

  /**
   * @returns the resolved lexicon, or `null` if this resolver does not provide
   *   the given NSID (so the next resolver / network fallback can be tried).
   */
  async resolve(nsid: NSID): Promise<ResolvedLexicon> {
    for (const resolver of this.resolvers) {
      const result = await resolver.resolve(nsid)
      if (result) return result
    }
    return this.lexResolver.get(nsid)
  }
}

function buildPartialResolver(
  options: CreateResolversOptions,
  config: LexiconResolverConfig,
): PartialLexiconResolver {
  switch (config.type) {
    case 'directory':
      return new DirectoryResolver(
        resolve(dirname(options.manifest), config.path),
      )
    case 'repo':
      return new RepoResolver(async () => {
        return buildClient(config.repo, options)
      })
    case 'http':
      return new HttpResolver(config.base, options.fetch)
    default:
      throw new Error(
        `Unsupported lexicon resolver type: ${(config as { type: string }).type}`,
      )
  }
}
