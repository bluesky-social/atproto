import { statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  type BuildFilterOptions,
  type Filter,
  buildFilter,
} from '@atproto/lex-builder'
import {
  type LexiconDocument,
  lexiconDocumentSchema,
} from '@atproto/lex-document'
import {
  type AtUri,
  LexResolver,
  type LexResolverOptions,
  LexResolverRecordNotFoundError,
} from '@atproto/lex-resolver'
import type { AgentConfig, AtIdentifierString } from '@atproto/lex-rpc'
import {
  type AtUriString,
  type DidString,
  type NSID,
  isDidIdentifier,
} from '@atproto/syntax'
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

  /**
   * Whether this resolver should throw an error if it fails to resolve an NSID
   * that is included in its explicit "include" list and not excluded by an
   * "exclude" list.
   */
  protected readonly shouldErrorOnMissing: boolean

  constructor(
    protected readonly resolver: PartialLexiconResolver,
    options: BuildFilterOptions,
  ) {
    this.filter = buildFilter(options)
    this.shouldErrorOnMissing =
      options?.include != null && options?.exclude == null
  }

  async resolve(nsid: NSID): Promise<ResolvedLexicon | null> {
    if (!this.filter(nsid.toString())) return null

    const result = await this.resolver.resolve(nsid)
    if (result) return result

    if (this.shouldErrorOnMissing) {
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

type RepoResolverOptions = BuildClientFromDidOptions &
  AtprotoHandleResolverNodeOptions & {
    handleResolver?: HandleResolver
  }

export type BuildClientFromDidOptions = CreateDidResolverOptions &
  Omit<AgentConfig, 'did' | 'service'>

export class RepoResolver implements PartialLexiconResolver {
  constructor(
    protected readonly repo: AtIdentifierString,
    protected readonly lexResolver: LexResolver,
    protected readonly options?: RepoResolverOptions,
  ) {}

  #didPromise: Promise<DidString> | undefined
  async getDid(): Promise<DidString> {
    return (this.#didPromise ??= Promise.resolve().then(async () => {
      const { repo, options } = this
      if (isDidIdentifier(repo)) return repo
      const handleResolver =
        options?.handleResolver ?? new AtprotoHandleResolverNode(options)
      const did = await handleResolver.resolve(repo)
      if (did) return did
      throw new Error(`Unable to resolve DID for handle: ${repo}`)
    }))
  }

  /**
   * @note we never return "null" on 404/Not-found errors to prevent the
   * resolution from falling through the next resolver in the chain. Users are
   * expected to use include/exclude filters to control which NSIDs are resolved
   * in the defined repo.
   */
  async resolve(nsid: NSID): Promise<ResolvedLexicon | null> {
    const did = await this.getDid()
    return this.lexResolver.fetch(did, nsid).catch((err) => {
      if (err instanceof LexResolverRecordNotFoundError) return null
      throw err
    })
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
  RepoResolverOptions & {
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
      const resolver = buildPartialResolver(this.lexResolver, options, config)
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
  lexResolver: LexResolver,
  options: CreateResolversOptions,
  config: LexiconResolverConfig,
): PartialLexiconResolver {
  switch (config.type) {
    case 'directory':
      return new DirectoryResolver(
        resolve(dirname(options.manifest), config.path),
      )
    case 'repo': {
      return new RepoResolver(config.repo, lexResolver, options)
    }
    case 'http':
      return new HttpResolver(config.base, options.fetch)
    default:
      throw new Error(
        `Unsupported lexicon resolver type: ${(config as { type: string }).type}`,
      )
  }
}
