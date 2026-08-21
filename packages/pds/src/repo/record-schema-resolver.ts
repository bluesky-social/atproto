import type { RecordSchema } from '@atproto/lex'
import { l } from '@atproto/lex'
import {
  type LexiconDocument,
  type LexiconIndexer,
  LexiconSchemaBuilder,
} from '@atproto/lex-document'

const DEFAULT_POSITIVE_TTL_MS = 5 * 60 * 1000
const DEFAULT_NEGATIVE_TTL_MS = 30 * 1000
const DEFAULT_MAX_POSITIVE_ENTRIES = 256
const DEFAULT_MAX_NEGATIVE_ENTRIES = 256
const DEFAULT_MAX_INFLIGHT_RESOLUTIONS = 32
const DEFAULT_MAX_DOCUMENTS_PER_SCHEMA = 32
const DEFAULT_MAX_REFERENCES_PER_SCHEMA = 128
const DEFAULT_MAX_FETCH_CONCURRENCY = 4
const DEFAULT_BUILD_TIMEOUT_MS = 10_000

type LexiconDocumentResolver = {
  get(
    nsid: string,
    options?: { signal?: AbortSignal },
  ): Promise<{ lexicon: LexiconDocument }>
}

type CacheEntry<T> = {
  expiresAt: number
  value: T
}

export type RecordSchemaResolverOptions = {
  positiveTtlMs?: number
  negativeTtlMs?: number
  maxPositiveEntries?: number
  maxNegativeEntries?: number
  maxInflightResolutions?: number
  maxDocumentsPerSchema?: number
  maxReferencesPerSchema?: number
  maxFetchConcurrency?: number
  buildTimeoutMs?: number
  now?: () => number
}

/** Resolves a record schema for an NSID. */
export type RecordSchemaResolver = {
  resolve(nsid: string): Promise<RecordSchema>
}

/** A stable error that does not expose resolver or upstream response details. */
export class RecordSchemaResolutionError extends Error {
  name = 'RecordSchemaResolutionError'

  constructor(nsid: string) {
    super(`Unable to resolve record schema for ${nsid}`)
  }
}

/** Builds record validators from proof-verified, published Lexicon documents. */
export class PublishedRecordSchemaResolver implements RecordSchemaResolver {
  readonly #positive = new Map<string, CacheEntry<RecordSchema>>()
  readonly #negative = new Map<string, CacheEntry<true>>()
  readonly #inflight = new Map<string, Promise<RecordSchema>>()
  #activeBuilds = 0
  readonly #positiveTtlMs: number
  readonly #negativeTtlMs: number
  readonly #maxPositiveEntries: number
  readonly #maxNegativeEntries: number
  readonly #maxInflightResolutions: number
  readonly #maxDocumentsPerSchema: number
  readonly #maxReferencesPerSchema: number
  readonly #maxFetchConcurrency: number
  readonly #buildTimeoutMs: number
  readonly #now: () => number

  constructor(
    private readonly lexResolver: LexiconDocumentResolver,
    options: RecordSchemaResolverOptions = {},
  ) {
    this.#positiveTtlMs = options.positiveTtlMs ?? DEFAULT_POSITIVE_TTL_MS
    this.#negativeTtlMs = options.negativeTtlMs ?? DEFAULT_NEGATIVE_TTL_MS
    this.#maxPositiveEntries =
      options.maxPositiveEntries ?? DEFAULT_MAX_POSITIVE_ENTRIES
    this.#maxNegativeEntries =
      options.maxNegativeEntries ?? DEFAULT_MAX_NEGATIVE_ENTRIES
    this.#maxInflightResolutions = atLeastOne(
      options.maxInflightResolutions ?? DEFAULT_MAX_INFLIGHT_RESOLUTIONS,
    )
    this.#maxDocumentsPerSchema = atLeastOne(
      options.maxDocumentsPerSchema ?? DEFAULT_MAX_DOCUMENTS_PER_SCHEMA,
    )
    this.#maxReferencesPerSchema = atLeastOne(
      options.maxReferencesPerSchema ?? DEFAULT_MAX_REFERENCES_PER_SCHEMA,
    )
    this.#maxFetchConcurrency = atLeastOne(
      options.maxFetchConcurrency ?? DEFAULT_MAX_FETCH_CONCURRENCY,
    )
    this.#buildTimeoutMs = atLeastOne(
      options.buildTimeoutMs ?? DEFAULT_BUILD_TIMEOUT_MS,
    )
    this.#now = options.now ?? Date.now
  }

  async resolve(nsid: string): Promise<RecordSchema> {
    const key = nsid.toString()
    const cached = this.#get(this.#positive, key)
    if (cached) return cached

    if (this.#get(this.#negative, key)) {
      throw new RecordSchemaResolutionError(nsid)
    }

    const existing = this.#inflight.get(key)
    if (existing) return existing
    if (this.#activeBuilds >= this.#maxInflightResolutions) {
      throw new RecordSchemaResolutionError(nsid)
    }

    const pending = this.#build(nsid).then(
      (schema) => {
        this.#negative.delete(key)
        this.#set(
          this.#positive,
          key,
          schema,
          this.#positiveTtlMs,
          this.#maxPositiveEntries,
        )
        return schema
      },
      () => {
        this.#positive.delete(key)
        this.#set(
          this.#negative,
          key,
          true,
          this.#negativeTtlMs,
          this.#maxNegativeEntries,
        )
        throw new RecordSchemaResolutionError(nsid)
      },
    )
    this.#inflight.set(key, pending)

    try {
      return await pending
    } finally {
      if (this.#inflight.get(key) === pending) {
        this.#inflight.delete(key)
      }
    }
  }

  async #build(nsid: string): Promise<RecordSchema> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.#buildTimeoutMs)
    timeout.unref()
    const documents = new Map<string, Promise<LexiconDocument>>()
    const withFetchSlot = createConcurrencyLimiter(
      this.#maxFetchConcurrency,
      controller.signal,
    )
    let referenceCount = 0
    const indexer: LexiconIndexer = {
      get: (refNsid) => {
        referenceCount += 1
        if (referenceCount > this.#maxReferencesPerSchema) {
          throw new Error('Lexicon reference graph exceeds reference limit')
        }

        const existing = documents.get(refNsid)
        if (existing) return existing
        if (documents.size >= this.#maxDocumentsPerSchema) {
          throw new Error('Lexicon reference graph exceeds document limit')
        }

        const pending = withFetchSlot(() =>
          this.lexResolver
            .get(refNsid, { signal: controller.signal })
            .then(({ lexicon }) => lexicon),
        )
        documents.set(refNsid, pending)
        return pending
      },
    }

    try {
      const deadline = new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(new Error('Record schema build timed out')),
          { once: true },
        )
      })
      const build = LexiconSchemaBuilder.build(indexer, `${nsid}#main`)
      this.#activeBuilds += 1
      void build.then(
        () => {
          this.#activeBuilds -= 1
        },
        () => {
          this.#activeBuilds -= 1
        },
      )
      const schema = await Promise.race([build, deadline])
      if (!(schema instanceof l.RecordSchema) || schema.$type !== nsid) {
        throw new Error('Published main definition is not the requested record')
      }
      return schema
    } finally {
      clearTimeout(timeout)
      controller.abort()
    }
  }

  #get<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
    const entry = cache.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.#now()) {
      cache.delete(key)
      return undefined
    }

    cache.delete(key)
    cache.set(key, entry)
    return entry.value
  }

  #set<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
    ttlMs: number,
    maxEntries: number,
  ): void {
    if (ttlMs <= 0 || maxEntries <= 0) return
    cache.delete(key)
    cache.set(key, { expiresAt: this.#now() + ttlMs, value })
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }
}

function atLeastOne(value: number): number {
  return Math.max(1, Math.floor(value))
}

function createConcurrencyLimiter(max: number, signal: AbortSignal) {
  let active = 0
  const waiters: Array<() => void> = []
  signal.addEventListener(
    'abort',
    () => {
      for (const resume of waiters.splice(0)) resume()
    },
    { once: true },
  )

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => waiters.push(resolve))
    }
    if (signal.aborted) throw new Error('Record schema build aborted')

    active += 1
    try {
      return await task()
    } finally {
      active -= 1
      waiters.shift()?.()
    }
  }
}
