import { resolveTxt } from 'node:dns/promises'
import * as crypto from '@atproto/crypto'
import { buildAgent, xrpc } from '@atproto/lex-client'
import { Cid } from '@atproto/lex-data'
import { LexiconDocument, lexiconDocumentSchema } from '@atproto/lex-document'
import {
  MST,
  MemoryBlockstore,
  def as repoDef,
  readCarWithRoot,
  verifyCommitSig,
} from '@atproto/repo'
import { AtUri, NSID, NsidString } from '@atproto/syntax'
import {
  AtprotoVerificationMethod,
  CreateDidResolverOptions,
  Did,
  DidResolver,
  ResolveDidOptions,
  assertDid,
  createDidResolver,
  extractAtprotoData,
} from '@atproto-labs/did-resolver'
import { LexResolverError } from './lex-resolver-error.js'
import { com } from './lexicons/index.js'

/**
 * Result returned when successfully resolving a lexicon document.
 *
 * Contains the full AT URI where the lexicon was found, the content-addressed
 * identifier (CID) for integrity verification, and the parsed lexicon document.
 */
export type LexResolverResult = {
  /** The AT URI where the lexicon document was found */
  uri: AtUri
  /** Content identifier (CID) of the lexicon record for integrity verification */
  cid: Cid
  /** The parsed and validated lexicon document */
  lexicon: LexiconDocument
}

/**
 * Result returned when fetching a lexicon document from a specific URI.
 *
 * This is a subset of {@link LexResolverResult} used internally and by hooks,
 * containing only the CID and lexicon document (without the URI, which is
 * already known from the fetch request).
 */
export type LexResolverFetchResult = {
  /** Content identifier (CID) of the lexicon record */
  cid: Cid
  /** The parsed and validated lexicon document */
  lexicon: LexiconDocument
}

export type Awaitable<T> = T | Promise<T>

/**
 * Callback hooks for customizing the lexicon resolution process.
 *
 * Hooks allow you to intercept, cache, or override the default resolution
 * behavior at various stages. Each hook can be synchronous or asynchronous.
 *
 * @example Implementing a cache with hooks
 * ```typescript
 * import { LexResolver, LexResolverHooks, LexResolverFetchResult } from '@atproto/lex-resolver'
 * import { AtUri } from '@atproto/syntax'
 *
 * const cache = new Map<string, LexResolverFetchResult>()
 *
 * const hooks: LexResolverHooks = {
 *   // Return cached result if available, bypassing network fetch
 *   onFetch({ uri }) {
 *     return cache.get(uri.toString())
 *   },
 *   // Cache successful fetches
 *   onFetchResult({ uri, cid, lexicon }) {
 *     cache.set(uri.toString(), { cid, lexicon })
 *   },
 *   // Log errors for monitoring
 *   onFetchError({ uri, err }) {
 *     console.error(`Failed to fetch ${uri}:`, err)
 *   }
 * }
 *
 * const resolver = new LexResolver({ hooks })
 * ```
 *
 * @example Overriding authority resolution for testing
 * ```typescript
 * const hooks: LexResolverHooks = {
 *   // Always resolve to a test DID
 *   onResolveAuthority({ nsid }) {
 *     if (nsid.authority === 'test.example') {
 *       return 'did:plc:test123'
 *     }
 *     // Return undefined to use default resolution
 *   }
 * }
 * ```
 */
export type LexResolverHooks = {
  /**
   * Hook called before resolving a lexicon authority DID. If a DID is returned,
   * it will be used instead of performing the default resolution. In that case,
   * the `onResolveAuthorityResult` and `onResolveAuthorityError` hooks will
   * not be called.
   *
   * @param data - Object containing the NSID being resolved
   * @returns A DID to use instead of default resolution, or void/undefined to proceed normally
   */
  onResolveAuthority?(data: { nsid: NSID }): Awaitable<void | Did>

  /**
   * Hook called after successfully resolving a lexicon authority DID.
   *
   * @param data - Object containing the NSID and resolved DID
   */
  onResolveAuthorityResult?(data: { nsid: NSID; did: Did }): Awaitable<void>

  /**
   * Hook called when authority resolution fails.
   *
   * @param data - Object containing the NSID and error that occurred
   */
  onResolveAuthorityError?(data: { nsid: NSID; err: unknown }): Awaitable<void>

  /**
   * Hook called before fetching a lexicon URI. If a result is returned, it will
   * be used instead of performing the default fetch. In that case, the
   * `onFetchResult` and `onFetchError` hooks will not be called.
   *
   * @param data - Object containing the URI being fetched
   * @returns A fetch result to use instead of default fetch, or void/undefined to proceed normally
   */
  onFetch?(data: { uri: AtUri }): Awaitable<void | LexResolverFetchResult>

  /**
   * Hook called after successfully fetching a lexicon document.
   *
   * @param data - Object containing the URI, CID, and parsed lexicon document
   */
  onFetchResult?(data: {
    uri: AtUri
    cid: Cid
    lexicon: LexiconDocument
  }): Awaitable<void>

  /**
   * Hook called when fetching fails.
   *
   * @param data - Object containing the URI and error that occurred
   */
  onFetchError?(data: { uri: AtUri; err: unknown }): Awaitable<void>
}

/**
 * Configuration options for the {@link LexResolver}.
 *
 * Extends DID resolver options with lexicon-specific hooks for customizing
 * the resolution process.
 *
 * @see {@link CreateDidResolverOptions} for DID resolver configuration
 */
export type LexResolverOptions = CreateDidResolverOptions & {
  /**
   * Optional hooks for customizing the resolution process.
   * See {@link LexResolverHooks} for available callbacks.
   */
  hooks?: LexResolverHooks
}

export { AtUri, type Cid, NSID }
export type { LexiconDocument, ResolveDidOptions }

/**
 * Resolves Lexicon documents from the AT Protocol network.
 *
 * The {@link LexResolver} handles the complete process of resolving a lexicon
 * by NSID:
 * 1. **Authority Resolution**: Looks up the `_lexicon.<authority>` DNS TXT record
 *    to find the DID that controls lexicons for that namespace
 * 2. **DID Resolution**: Resolves the DID document to find the PDS endpoint and
 *    signing key
 * 3. **Record Fetch**: Fetches the lexicon record from the PDS with cryptographic
 *    proof verification
 * 4. **Validation**: Validates the lexicon document structure
 *
 * @example Basic usage - resolve a lexicon by NSID
 * ```typescript
 * import { LexResolver } from '@atproto/lex-resolver'
 *
 * const resolver = new LexResolver({})
 *
 * // Get a lexicon document by its NSID
 * const result = await resolver.get('app.bsky.feed.post')
 * console.log(result.lexicon) // The parsed lexicon document
 * console.log(result.uri)     // AT URI where it was found
 * console.log(result.cid)     // Content identifier for verification
 * ```
 *
 * @example Two-step resolution for more control
 * ```typescript
 * import { LexResolver } from '@atproto/lex-resolver'
 *
 * const resolver = new LexResolver({})
 *
 * // Step 1: Resolve the authority to get the AT URI
 * const uri = await resolver.resolve('app.bsky.feed.post')
 * console.log(uri.toString()) // 'at://did:plc:xxx/com.atproto.lexicon.schema/app.bsky.feed.post'
 *
 * // Step 2: Fetch the lexicon from the URI
 * const result = await resolver.fetch(uri)
 * console.log(result.lexicon)
 * ```
 *
 * @example Using hooks for caching
 * ```typescript
 * import { LexResolver, LexResolverFetchResult } from '@atproto/lex-resolver'
 *
 * const cache = new Map<string, LexResolverFetchResult>()
 *
 * const resolver = new LexResolver({
 *   hooks: {
 *     onFetch({ uri }) {
 *       return cache.get(uri.toString())
 *     },
 *     onFetchResult({ uri, cid, lexicon }) {
 *       cache.set(uri.toString(), { cid, lexicon })
 *     }
 *   }
 * })
 * ```
 *
 * @example Error handling
 * ```typescript
 * import { LexResolver, LexResolverError } from '@atproto/lex-resolver'
 *
 * const resolver = new LexResolver({})
 *
 * try {
 *   const result = await resolver.get('com.example.unknown')
 * } catch (error) {
 *   if (error instanceof LexResolverError) {
 *     console.error(`Failed to resolve ${error.nsid}: ${error.description}`)
 *   }
 * }
 * ```
 */
export class LexResolver {
  protected readonly didResolver: DidResolver<'plc' | 'web'>

  constructor(protected readonly options: LexResolverOptions) {
    this.didResolver = createDidResolver(options)
  }

  /**
   * Gets a lexicon document by its NSID.
   *
   * This is the primary method for resolving lexicons. It combines
   * {@link resolve} and {@link fetch} into a single operation, handling
   * authority resolution, DID lookup, and record fetching.
   *
   * @param nsidStr - The NSID to resolve, either as a string or NSID object
   * @param options - Optional DID resolution options (e.g., signal for cancellation)
   * @returns The resolved lexicon result containing URI, CID, and lexicon document
   * @throws {LexResolverError} If resolution fails at any stage
   *
   * @example
   * ```typescript
   * // Resolve using string NSID
   * const result = await resolver.get('app.bsky.feed.post')
   *
   * // Resolve using NSID object
   * import { NSID } from '@atproto/syntax'
   * const nsid = NSID.from('app.bsky.feed.post')
   * const result = await resolver.get(nsid)
   *
   * // With abort signal for cancellation
   * const controller = new AbortController()
   * const result = await resolver.get('app.bsky.feed.post', {
   *   signal: controller.signal
   * })
   * ```
   */
  async get(
    nsidStr: NSID | string,
    options?: ResolveDidOptions,
  ): Promise<LexResolverResult> {
    const uri = await this.resolve(nsidStr)
    return this.fetch(uri, options)
  }

  /**
   * Resolves the authority for an NSID and returns the AT URI for the lexicon.
   *
   * This method performs the first stage of lexicon resolution:
   * 1. Parses the NSID to extract the authority domain
   * 2. Looks up the `_lexicon.<authority>` DNS TXT record
   * 3. Extracts the DID from the TXT record (format: `did=<did>`)
   * 4. Constructs the AT URI for the lexicon record
   *
   * Use this when you need the URI without fetching the actual document,
   * or when you want to implement custom fetching logic.
   *
   * @param nsidStr - The NSID to resolve, either as a string or NSID object
   * @returns The AT URI pointing to the lexicon record
   * @throws {LexResolverError} If authority resolution fails (e.g., DNS lookup fails)
   *
   * @example
   * ```typescript
   * // Resolve to get the AT URI
   * const uri = await resolver.resolve('app.bsky.feed.post')
   * console.log(uri.toString())
   * // Output: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.atproto.lexicon.schema/app.bsky.feed.post'
   *
   * // The URI can then be used with fetch() or stored for later use
   * const result = await resolver.fetch(uri)
   * ```
   */
  async resolve(nsidStr: NSID | string): Promise<AtUri> {
    const nsid = NSID.from(nsidStr)

    const did =
      (await this.options.hooks?.onResolveAuthority?.({ nsid })) ??
      (await this.resolveLexiconAuthority(nsid).then(
        async (did) => {
          await this.options.hooks?.onResolveAuthorityResult?.({ nsid, did })
          return did
        },
        async (err) => {
          await this.options.hooks?.onResolveAuthorityError?.({ nsid, err })
          throw err
        },
      ))

    return AtUri.make(did, 'com.atproto.lexicon.schema', nsid.toString())
  }

  // @TODO This class could be made compatible with browsers by making the
  // following method abstract and/or by allowing the caller to inject a DNS
  // resolver implementation (based on DNS-over-HTTPS or similar), instead of
  // using the Node.js built-in resolver.
  protected async resolveLexiconAuthority(nsid: NSID): Promise<Did> {
    try {
      return await getDomainTxtDid(`_lexicon.${nsid.authority}`)
    } catch (cause) {
      throw new LexResolverError(
        nsid,
        `Failed to resolve lexicon DID authority for ${nsid}`,
        { cause },
      )
    }
  }

  /**
   * Fetches a lexicon document from a specific AT URI.
   *
   * This method performs the second stage of lexicon resolution:
   * 1. Resolves the DID from the URI to find the PDS endpoint
   * 2. Fetches the record from the PDS using `com.atproto.sync.getRecord`
   * 3. Verifies the cryptographic proof (commit signature)
   * 4. Validates the lexicon document structure
   * 5. Ensures the document ID matches the URI rkey
   *
   * Use this when you already have an AT URI (e.g., from {@link resolve})
   * and want to fetch the lexicon document.
   *
   * @param uriStr - The AT URI to fetch, either as a string or AtUri object
   * @param options - Optional DID resolution options (e.g., signal for cancellation, noCache)
   * @returns The resolved lexicon result containing URI, CID, and lexicon document
   * @throws {LexResolverError} If fetching or validation fails
   *
   * @example
   * ```typescript
   * // Fetch from a known URI
   * const result = await resolver.fetch(
   *   'at://did:plc:xyz/com.atproto.lexicon.schema/app.bsky.feed.post'
   * )
   *
   * // Fetch with no-cache to bypass any upstream caching
   * const result = await resolver.fetch(uri, { noCache: true })
   *
   * // Fetch with abort signal
   * const controller = new AbortController()
   * const result = await resolver.fetch(uri, { signal: controller.signal })
   * ```
   */
  async fetch(
    uriStr: AtUri | string,
    options?: ResolveDidOptions,
  ): Promise<LexResolverResult> {
    const uri = typeof uriStr === 'string' ? new AtUri(uriStr) : uriStr

    const { lexicon, cid } =
      (await this.options.hooks?.onFetch?.({ uri })) ??
      (await this.fetchLexiconUri(uri, options).then(
        async (res) => {
          await this.options.hooks?.onFetchResult?.({ uri, ...res })
          return res
        },
        async (err) => {
          await this.options.hooks?.onFetchError?.({ uri, err })
          throw err
        },
      ))

    return { uri, cid, lexicon }
  }

  protected async fetchLexiconUri(
    uri: AtUri,
    options?: ResolveDidOptions,
  ): Promise<LexResolverFetchResult> {
    const { did, nsid } = parseLexiconUri(uri)

    const { pds, key } = await this.didResolver
      .resolve(did, options)
      .then(extractAtprotoData)
      .catch((cause) => {
        throw new LexResolverError(
          nsid,
          `Failed to resolve DID document for ${did}`,
          { cause },
        )
      })

    if (!key || !pds || !URL.canParse(pds.serviceEndpoint)) {
      throw new LexResolverError(
        nsid,
        `No atproto PDS service endpoint or signing key found in ${did} DID document`,
      )
    }

    const agent = buildAgent({
      service: pds.serviceEndpoint,
      fetch: this.options.fetch,
    })

    const collection = 'com.atproto.lexicon.schema'
    const rkey = nsid.toString()

    const { cid, record } = await xrpc(agent, com.atproto.sync.getRecord, {
      signal: options?.signal,
      headers: options?.noCache ? { 'Cache-Control': 'no-cache' } : undefined,
      params: { did, collection, rkey },
    }).then(
      ({ body }) => {
        return verifyRecordProof(body, did, key, collection, rkey).catch(
          (cause) => {
            throw new LexResolverError(
              nsid,
              `Failed to verify Lexicon record proof at ${uri}`,
              { cause },
            )
          },
        )
      },
      (cause) => {
        throw new LexResolverError(nsid, `Failed to fetch Record ${uri}`, {
          cause,
        })
      },
    )

    const validationResult = lexiconDocumentSchema.safeParse(record)
    if (!validationResult.success) {
      throw new LexResolverError(nsid, `Invalid Lexicon document at ${uri}`, {
        cause: validationResult.reason,
      })
    }

    const lexicon = validationResult.value
    if (lexicon.id !== uri.rkey) {
      throw new LexResolverError(
        nsid,
        `Invalid document id "${lexicon.id}" at ${uri}`,
      )
    }

    return { lexicon, cid }
  }
}

function parseLexiconUri(uri: AtUri): {
  did: Did
  nsid: NSID
} {
  // Validate input URI
  const nsid = NSID.from(uri.rkey)
  try {
    const did = uri.host
    assertDid(did)
    return { did, nsid }
  } catch (cause) {
    throw new LexResolverError(nsid, `URI host is not a DID ${uri}`, { cause })
  }
}

async function getDomainTxtDid(domain: string): Promise<Did> {
  const didLines = (await resolveTxt(domain))
    .map((chunks) => chunks.join(''))
    .filter((i) => i.startsWith('did='))

  if (didLines.length === 1) {
    const did = didLines[0].slice(4)
    assertDid(did)
    return did
  }

  throw didLines.length > 1
    ? new Error('Multiple DIDs found in DNS TXT records')
    : new Error('No DID found in DNS TXT records')
}

async function verifyRecordProof(
  car: Uint8Array,
  did: Did,
  key: AtprotoVerificationMethod,
  collection: NsidString,
  rkey: string,
) {
  const { root, blocks } = await readCarWithRoot(car)
  const blockstore = new MemoryBlockstore(blocks)

  const commit = await blockstore.readObj(root, repoDef.commit)
  if (commit.did !== did) {
    throw new Error(`Invalid repo did: ${commit.did}`)
  }

  const signingKey = getDidKeyFromMultibase(key)
  const validSig = await verifyCommitSig(commit, signingKey)
  if (!validSig) {
    throw new Error(`Invalid signature on commit: ${root.toString()}`)
  }

  const mst = MST.load(blockstore, commit.data)

  const cid = await mst.get(`${collection}/${rkey}`)
  if (!cid) throw new Error('Record not found in proof')

  const record = await blockstore.readRecord(cid)
  if (record?.$type !== collection) {
    throw new Error(
      `Invalid record type: expected ${collection}, got ${record?.$type}`,
    )
  }

  return { cid, record }
}

function getDidKeyFromMultibase(key: AtprotoVerificationMethod) {
  switch (key.type) {
    case 'EcdsaSecp256r1VerificationKey2019': {
      const keyBytes = crypto.multibaseToBytes(key.publicKeyMultibase)
      return crypto.formatDidKey(crypto.P256_JWT_ALG, keyBytes)
    }
    case 'EcdsaSecp256k1VerificationKey2019': {
      const keyBytes = crypto.multibaseToBytes(key.publicKeyMultibase)
      return crypto.formatDidKey(crypto.SECP256K1_JWT_ALG, keyBytes)
    }
    case 'Multikey': {
      const { jwtAlg, keyBytes } = crypto.parseMultikey(key.publicKeyMultibase)
      return crypto.formatDidKey(jwtAlg, keyBytes)
    }
    default: {
      // Should never happen
      throw new Error(`Unsupported verification method type: ${key.type}`)
    }
  }
}
