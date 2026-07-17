import type { LexMap, LexValue, TypedLexMap } from '@atproto/lex-data'
import type {
  AtIdentifierString,
  AtUriString,
  CidString,
  DidString,
  Infer,
  InferMethodInputBody,
  InferMethodOutputBody,
  InferRecordKey,
  LexiconRecordKey,
  Main,
  NsidString,
  Params,
  Restricted,
} from '@atproto/lex-schema'
import { Procedure, Query, RecordSchema, getMain } from '@atproto/lex-schema'
import type { Agent, AgentOptions } from './agent.js'
import { buildAgent } from './agent.js'
import type { XrpcFailure } from './errors.js'
// @NOTE We could use import { com } from "./lexicons/index.js" here, but some
// consumers might not know how to properly tree-shake that, so we import only
// the needed lexicon schemas directly.
import applyWrites from './lexicons/com/atproto/repo/applyWrites.js'
import createRecord from './lexicons/com/atproto/repo/createRecord.js'
import deleteRecord from './lexicons/com/atproto/repo/deleteRecord.js'
import getRecord from './lexicons/com/atproto/repo/getRecord.js'
import listRecords, {
  type Record as ListRecordsRecord,
} from './lexicons/com/atproto/repo/listRecords.js'
import putRecord from './lexicons/com/atproto/repo/putRecord.js'
import uploadBlob from './lexicons/com/atproto/repo/uploadBlob.js'
import getBlob from './lexicons/com/atproto/sync/getBlob.js'
import type {
  XrpcResponse,
  XrpcResponseBody,
  XrpcResponseOptions,
} from './response.js'
import { type BinaryBodyInit, type Service, isService } from './types.js'
import {
  type RecordKeyOptions,
  type XrpcRequestHeadersOptions,
  applyDefaults,
  getDefaultRecordKey,
  getLiteralRecordKey,
  mergeHeaders,
} from './util.js'
import {
  type WriteOperation,
  type WriteOperationCreateOptions,
  type WriteOperationDeleteOptions,
  WriteOperationHelper,
  type WriteOperationUpdateOptions,
  type WriteOperationsFactory,
} from './write-operation-builder.js'
import {
  type XrpcOptions,
  type XrpcRequestParams,
  type XrpcRequestProcessingOptions,
  xrpc,
  xrpcSafe,
} from './xrpc.js'

export {
  type AtIdentifierString,
  type CidString,
  type DidString,
  type Infer,
  type InferMethodInputBody,
  type InferMethodOutputBody,
  type InferRecordKey,
  type LexMap,
  type LexValue,
  type LexiconRecordKey,
  type Main,
  type NsidString,
  type Params,
  Procedure,
  Query,
  RecordSchema,
  type Restricted,
  type TypedLexMap,
  type WriteOperation,
  type WriteOperationCreateOptions,
  type WriteOperationDeleteOptions,
  WriteOperationHelper,
  type WriteOperationUpdateOptions,
  type WriteOperationsFactory,
}

/**
 * Configuration options for creating a {@link Client}.
 *
 * @property {@link ClientOptions.labelers} - An iterable of labeler DIDs to include in requests. These will be combined with any global app labelers configured via {@link Client.configure}.
 * @property {@link ClientOptions.service} - An optional service identifier (DID or URL) for routing requests with service proxying.
 * @property {@link ClientOptions.headers} - Custom headers to include in all requests made by this client instance.
 * @property {@link ClientOptions.validateRequest} - If true, validates request bodies against their lexicon schemas before sending. Defaults to false for performance.
 * @property {@link ClientOptions.validateResponse} - If false, skips validation of response bodies against their lexicon schemas. Defaults to true to catch errors, but can be disabled for performance if you trust the server responses. Note that defaults will not be applied if validation is disabled, which can cause typing inconsistencies, so use with caution.
 * @property {@link ClientOptions.strictResponseProcessing} - If false, relaxes certain validation rules during response processing (e.g., allowing floats, deeper nesting, etc.). Defaults to true for strict compliance with {@link https://atproto.com/specs/data-model lexicon data model}, but can be disabled to handle non-compliant responses.
 *
 * @see {@link XrpcRequestHeadersOptions}
 * @see {@link XrpcRequestProcessingOptions}
 * @see {@link XrpcResponseOptions}
 *
 * @example
 * ```typescript
 * const options: ClientOptions = {
 *   labelers: ['did:plc:labeler1'],
 *   service: 'did:web:api.bsky.app#bsky_appview',
 *   headers: { 'X-Custom-Header': 'value' },
 *   validateRequest: false,
 *   validateResponse: true,
 *   strictResponseProcessing: false,
 * }
 * ```
 */
export type ClientOptions = XrpcRequestHeadersOptions &
  Pick<XrpcRequestProcessingOptions, 'validateRequest'> &
  XrpcResponseOptions

export type ActionOptions = {
  /** AbortSignal to cancel the request. */
  signal?: AbortSignal
}

/**
 * A composable action that can be invoked via {@link Client.call}.
 *
 * Actions provide a way to define custom operations that integrate with the
 * Client's call interface, enabling type-safe, reusable business logic.
 *
 * @typeParam I - The input type for the action
 * @typeParam O - The output type for the action
 *
 * @example
 * ```typescript
 * const myAction: Action<{ userId: string }, { profile: Profile }> = async (client, input, options) => {
 *   const response = await client.xrpc(someMethod, { params: { actor: input.userId }, ...options })
 *   return { profile: response.body }
 * }
 * ```
 */
export type Action<I = any, O = any> = (
  client: Client,
  input: I,
  options: ActionOptions,
) => O | Promise<O>

/**
 * Extracts the input type from an {@link Action}.
 * @typeParam A - The Action type to extract from
 */
export type InferActionInput<A extends Action> =
  A extends Action<infer I, any> ? I : never

/**
 * Extracts the output type from an {@link Action}.
 * @typeParam A - The Action type to extract from
 */
export type InferActionOutput<A extends Action> =
  A extends Action<any, infer O> ? O : never

/**
 * Options for creating a record in an AT Protocol repository.
 *
 * @see {@link Client.createRecord}
 */
export type CreateRecordOptions = Omit<
  XrpcOptions<typeof createRecord>,
  'body'
> & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
  /** Compare-and-swap on the repo commit. If specified, must match current commit. */
  swapCommit?: string
  /**
   * Whether the PDS should validate the record against its lexicon schema.
   * When `true`, the PDS is asked to explicitly validate the record. When
   * `false`, the PDS is asked to explicitly skip validation. When `undefined`
   * (default), the PDS decides -- typically validating only collections whose
   * schemas it knows. This is server-side validation; for client-side
   * validation before sending, use {@link XrpcRequestProcessingOptions.validateRequest}.
   */
  validate?: boolean
}

/**
 * Options for deleting a record from an AT Protocol repository.
 *
 * @see {@link Client.deleteRecord}
 */
export type DeleteRecordOptions = Omit<
  XrpcOptions<typeof deleteRecord>,
  'body'
> & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
  /** Compare-and-swap on the repo commit. If specified, must match current commit. */
  swapCommit?: string
  /** Compare-and-swap on the record CID. If specified, must match current record. */
  swapRecord?: string
}

/**
 * Options for retrieving a record from an AT Protocol repository.
 *
 * @see {@link Client.getRecord}
 */
export type GetRecordOptions = Omit<XrpcOptions<typeof getRecord>, 'params'> & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
}

/**
 * Options for creating or updating a record in an AT Protocol repository.
 *
 * @see {@link Client.putRecord}
 */
export type PutRecordOptions = Omit<XrpcOptions<typeof putRecord>, 'body'> & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
  /** Compare-and-swap on the repo commit. If specified, must match current commit. */
  swapCommit?: string
  /** Compare-and-swap on the record CID. If specified, must match current record. */
  swapRecord?: string
  /**
   * Whether the PDS should validate the record against its lexicon schema.
   * When `true`, the PDS is asked to explicitly validate the record. When
   * `false`, the PDS is asked to explicitly skip validation. When `undefined`
   * (default), the PDS decides — typically validating only collections whose
   * schemas it knows. This is server-side validation; for client-side
   * validation before sending, use {@link XrpcRequestProcessingOptions.validateRequest}.
   */
  validate?: boolean
}

/**
 * Options for listing records in an AT Protocol repository collection.
 *
 * @see {@link Client.listRecords}
 */
export type ListRecordsOptions = Omit<
  XrpcOptions<typeof listRecords>,
  'params'
> & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
  /** Maximum number of records to return. */
  limit?: number
  /** Pagination cursor from a previous response. */
  cursor?: string
  /** If true, returns records in reverse chronological order. */
  reverse?: boolean
}

/**
 * Options for applying a batch of writes (create/update/delete) to an AT Protocol repository.
 *
 * @see {@link Client.applyWrites}
 */
export type ApplyWritesOptions = Omit<
  XrpcOptions<typeof applyWrites>,
  'body'
> & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
  /**
   * Whether the PDS should validate the records against their lexicon schemas.
   * When `true`, the PDS is asked to explicitly validate every record. When
   * `false`, the PDS is asked to explicitly skip validation. When `undefined`
   * (default), the PDS decides — typically validating only collections whose
   * schemas it knows.
   */
  validate?: boolean
  /** Compare-and-swap on the repo commit. If specified, must match current commit. */
  swapCommit?: CidString
}

export type UploadBlobOptions = Omit<XrpcOptions<typeof uploadBlob>, 'body'>

export type GetBlobOptions = Omit<XrpcOptions<typeof getBlob>, 'params'>

/**
 * Type-safe options for {@link Client.create}, combining record options with key requirements.
 * @typeParam T - The record schema type
 * @see {@link CreateRecordOptions}
 */
export type CreateOptions<T extends RecordSchema> = CreateRecordOptions &
  RecordKeyOptions<T, 'tid' | 'any'>

/**
 * Output type for record creation operations.
 * Contains the URI and CID of the newly created record.
 */
export type CreateOutput = InferMethodOutputBody<
  typeof createRecord,
  Uint8Array
>

/**
 * Type-safe options for {@link Client.delete}, combining delete options with key requirements.
 * @typeParam T - The record schema type
 */
export type DeleteOptions<T extends RecordSchema> = DeleteRecordOptions &
  RecordKeyOptions<T>

/**
 * Output type for record deletion operations.
 */
export type DeleteOutput = InferMethodOutputBody<
  typeof deleteRecord,
  Uint8Array
>

/**
 * Type-safe options for {@link Client.get}, combining get options with key requirements.
 * @typeParam T - The record schema type
 */
export type GetOptions<T extends RecordSchema> = GetRecordOptions &
  RecordKeyOptions<T>

/**
 * Output type for record retrieval operations.
 * Contains the record value validated against the schema type.
 * @typeParam T - The record schema type
 */
export type GetOutput<T extends RecordSchema> = Omit<
  InferMethodOutputBody<typeof getRecord, Uint8Array>,
  'value'
> & { value: Infer<T> }

/**
 * Type-safe options for {@link Client.put}, combining put options with key requirements.
 * @typeParam T - The record schema type
 */
export type PutOptions<T extends RecordSchema> = PutRecordOptions &
  RecordKeyOptions<T>

/**
 * Output type for record put (create/update) operations.
 * Contains the URI and CID of the record.
 */
export type PutOutput = InferMethodOutputBody<typeof putRecord, Uint8Array>

/**
 * Options for {@link Client.list} operations.
 */
export type ListOptions = ListRecordsOptions

/**
 * Output type for record listing operations.
 * Contains validated records and any invalid records that failed schema validation.
 * @typeParam T - The record schema type
 */
export type ListOutput<T extends RecordSchema> = Omit<
  InferMethodOutputBody<typeof listRecords>,
  'records'
> & {
  /** Records that successfully validated against the schema. */
  records: ListRecordItem<Infer<T>>[]
}

/**
 * A discriminated union type representing the result of a record listing
 * operation.
 */
export type ListRecordItem<Value extends LexMap> =
  | { uri: AtUriString; cid: CidString; valid: true; value: Value }
  | { uri: AtUriString; cid: CidString; valid: false; value: LexMap }

/**
 * The Client class is the primary interface for interacting with AT Protocol
 * services. It provides type-safe methods for XRPC calls, record operations,
 * and blob handling.
 *
 * @example
 * ```typescript
 * import { Client } from '@atproto/lex'
 * import { app } from '#/lexicons
 *
 * const client = new Client(oauthSession)
 *
 * const response = await client.xrpc(app.bsky.feed.getTimeline, {
 *   params: { limit: 50 }
 * })
 * ```
 */
export class Client {
  static appLabelers: readonly DidString[] = []

  /**
   * Configures the Client (or its sub classes) globally.
   */
  static configure(opts: { appLabelers?: Iterable<DidString> }) {
    if (opts.appLabelers) this.appLabelers = [...opts.appLabelers]
  }

  /** The underlying agent used for making requests. */
  public readonly agent: Agent

  /** Default header values to include in all requests made by this client instance. */
  public readonly headers: Headers

  /** Default {@link XrpcOptions} for this client instance. */
  public readonly xrpcDefaults: Readonly<{
    service: Service | null
    labelers: Set<DidString>
    appLabelers?: null | Iterable<DidString>
    validateRequest: boolean
    validateResponse: boolean
    strictResponseProcessing: boolean
  }>

  constructor(agent: Agent | AgentOptions, options: ClientOptions = {}) {
    this.agent = buildAgent(agent)
    this.headers = new Headers(options.headers)

    // @NOTE An "atproto-proxy" header provided through the `headers` option
    // acts as fallback for the `service` option.
    const service = this.headers.get('atproto-proxy')?.trim()

    this.xrpcDefaults = Object.freeze({
      service:
        options.service === undefined && service != null && isService(service)
          ? service
          : options.service ?? null,
      labelers: new Set(options.labelers),
      // @NOTE when provided (including `null`), will override the class wide
      // Client.appLabelers
      appLabelers:
        options.appLabelers != null
          ? new Set(options.appLabelers)
          : options.appLabelers,
      validateRequest: options.validateRequest ?? false,
      validateResponse: options.validateResponse ?? true,
      strictResponseProcessing: options.strictResponseProcessing ?? true,
    })
  }

  /**
   * The DID of the authenticated user, or `undefined` if not authenticated.
   */
  get did(): DidString | undefined {
    return this.agent.did
  }

  /**
   * The DID of the authenticated user.
   * @throws {Error} if not authenticated
   */
  get assertDid(): DidString {
    this.assertAuthenticated()
    return this.did
  }

  get service(): Service | null {
    return this.xrpcDefaults.service
  }

  get labelers(): Set<DidString> {
    return this.xrpcDefaults.labelers
  }

  /**
   * Asserts that the client is authenticated.
   * Use as a type guard when you need to ensure authentication.
   *
   * @throws {Error} if not authenticated
   *
   * @example
   * ```typescript
   * client.assertAuthenticated()
   * // TypeScript now knows client.did is defined
   * console.log(client.did)
   * ```
   */
  public assertAuthenticated(): asserts this is { did: DidString } {
    if (!this.did) throw new Error('Client is not authenticated')
  }

  /**
   * Replaces all labelers with the given set.
   * @param labelers - Iterable of labeler DIDs
   */
  public setLabelers(labelers: Iterable<DidString> = []) {
    this.clearLabelers()
    this.addLabelers(labelers)
  }

  /**
   * Adds labelers to the current set.
   * @param labelers - Iterable of labeler DIDs to add
   */
  public addLabelers(labelers: Iterable<DidString>) {
    for (const labeler of labelers) this.xrpcDefaults.labelers.add(labeler)
  }

  /**
   * Removes all labelers from this client instance.
   */
  public clearLabelers() {
    this.xrpcDefaults.labelers.clear()
  }

  /**
   * Makes an XRPC request. Throws on failure.
   *
   * @param ns - The lexicon method definition (e.g., `app.bsky.feed.getTimeline`)
   * @param options - Request options including params and body
   * @returns The successful XRPC response
   * @throws {XrpcFailure} when the request fails or returns an error
   *
   * @example Query with parameters
   * ```typescript
   * const response = await client.xrpc(app.bsky.feed.getTimeline, {
   *   params: { limit: 50, cursor: 'abc123' }
   * })
   * console.log(response.body.feed)
   * ```
   *
   * @example Procedure with body
   * ```typescript
   * const response = await client.xrpc(com.atproto.repo.createRecord, {
   *   body: {
   *     repo: client.assertDid,
   *     collection: 'app.bsky.feed.post',
   *     record: { text: 'Hello!', createdAt: new Date().toISOString() }
   *   }
   * })
   * ```
   *
   * @see {@link xrpcSafe} for a non-throwing variant
   */
  async xrpc<const M extends Query | Procedure>(
    ns: NonNullable<unknown> extends XrpcOptions<M>
      ? Main<M>
      : Restricted<'This XRPC method requires an "options" argument'>,
  ): Promise<XrpcResponse<M>>
  async xrpc<const M extends Query | Procedure>(
    ns: Main<M>,
    options: XrpcOptions<M>,
  ): Promise<XrpcResponse<M>>
  async xrpc<const M extends Query | Procedure>(
    ns: Main<M>,
    options: XrpcOptions<M> = {} as XrpcOptions<M>,
  ): Promise<XrpcResponse<M>> {
    return xrpc(this.agent, ns, this.buildXrpcOptions(options))
  }

  /**
   * Makes an XRPC request without throwing on failure.
   * Returns either a successful response or a failure object.
   *
   * @param ns - The lexicon method definition
   * @param options - Request options
   * @returns Either an XrpcResponse on success or XrpcFailure on failure
   *
   * @example
   * ```typescript
   * const result = await client.xrpcSafe(app.bsky.actor.getProfile, {
   *   params: { actor: 'alice.bsky.social' }
   * })
   *
   * if (result.success) {
   *   console.log(result.body.displayName)
   * } else {
   *   console.error('Failed:', result.error)
   * }
   * ```
   *
   * @see {@link xrpc} for a throwing variant
   */
  async xrpcSafe<const M extends Query | Procedure>(
    ns: NonNullable<unknown> extends XrpcOptions<M>
      ? Main<M>
      : Restricted<'This XRPC method requires an "options" argument'>,
  ): Promise<XrpcResponse<M> | XrpcFailure<M>>
  async xrpcSafe<const M extends Query | Procedure>(
    ns: Main<M>,
    options: XrpcOptions<M>,
  ): Promise<XrpcResponse<M> | XrpcFailure<M>>
  async xrpcSafe<const M extends Query | Procedure>(
    ns: Main<M>,
    options: XrpcOptions<M> = {} as XrpcOptions<M>,
  ): Promise<XrpcResponse<M> | XrpcFailure<M>> {
    return xrpcSafe(this.agent, ns, this.buildXrpcOptions(options))
  }

  protected buildXrpcOptions<M extends Query | Procedure>(
    options: XrpcOptions<M>,
  ): XrpcOptions<M> {
    // Apply the instance-wide defaults for service, labelers, and validation
    // options.
    const combined = applyDefaults(options, this.xrpcDefaults)

    // Dynamically apply the class-wide appLabelers if they are not already set
    // in the combined options.
    if (combined.appLabelers === undefined) {
      combined.appLabelers = (this.constructor as typeof Client).appLabelers
    }

    const optionsHeaders =
      options.headers != null ? new Headers(options.headers) : null

    // @NOTE we allow the "service" options to fallback to the "atproto-proxy"
    // header if it is present in the request-specific headers.
    if (options.service === undefined && optionsHeaders?.has('atproto-proxy')) {
      const serviceHeader = optionsHeaders.get('atproto-proxy')?.trim()
      if (serviceHeader != null && isService(serviceHeader)) {
        combined.service = serviceHeader
      }
    }

    // Merge the instance-wide headers with the request-specific headers.
    // Request-specific headers take precedence. This cannot be done in the
    // applyDefaults step above because headers require special merging logic.
    combined.headers = optionsHeaders
      ? mergeHeaders(this.headers, optionsHeaders)
      : new Headers(this.headers)

    // @NOTE Since the combined options here always contain a defined
    // "service" (even if null), any "atproto-proxy" header in either the
    // instance-wide or request-specific headers will be overridden by the
    // "service" value. Note that an "atproto-proxy" header provided through
    // the constructor's `headers` option is used as fallback for the
    // constructor's `service` option (see constructor), making the two
    // equivalent.
    return combined
  }

  /**
   * Creates a new record in an AT Protocol repository.
   *
   * @param record - The record to create, must include an {@link NsidString} `$type`
   * @param rkey - Optional record key; if omitted, server generates a TID
   * @param options - Create options including repo, swapCommit, validate
   * @returns The XRPC response containing the created record's URI and CID
   *
   * @example
   * ```typescript
   * const response = await client.createRecord(
   *   { $type: 'app.bsky.feed.post', text: 'Hello!', createdAt: new Date().toISOString() },
   *   undefined, // Let server generate rkey
   *   { validate: true }
   * )
   * console.log(response.body.uri)
   * ```
   *
   * @see {@link create} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  public async createRecord(
    record: TypedLexMap<NsidString>,
    rkey?: string,
    { service = null, labelers = null, ...options }: CreateRecordOptions = {},
  ) {
    return this.xrpc(createRecord, {
      ...options,
      service,
      labelers,
      body: {
        repo: options?.repo ?? this.assertDid,
        collection: record.$type,
        record,
        rkey,
        validate: options?.validate,
        swapCommit: options?.swapCommit,
      },
    })
  }

  /**
   * Deletes a record from an AT Protocol repository.
   *
   * @param collection - The collection NSID
   * @param rkey - The record key
   * @param options - Delete options including repo, swapCommit, swapRecord
   *
   * @see {@link delete} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async deleteRecord(
    collection: NsidString,
    rkey: string,
    { service = null, labelers = null, ...options }: DeleteRecordOptions = {},
  ) {
    return this.xrpc(deleteRecord, {
      ...options,
      service,
      labelers,
      body: {
        repo: options?.repo ?? this.assertDid,
        collection,
        rkey,
        swapCommit: options?.swapCommit,
        swapRecord: options?.swapRecord,
      },
    })
  }

  /**
   * Retrieves a record from an AT Protocol repository.
   *
   * @param collection - The collection NSID
   * @param rkey - The record key
   * @param options - Get options including repo
   *
   * @see {@link get} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  public async getRecord(
    collection: NsidString,
    rkey: string,
    { service = null, labelers = null, ...options }: GetRecordOptions = {},
  ) {
    return this.xrpc(getRecord, {
      ...options,
      service,
      labelers,
      params: {
        repo: options?.repo ?? this.assertDid,
        collection,
        rkey,
      },
    })
  }

  /**
   * Creates or updates a record in a repository.
   *
   * @param record - The record to put, must include an {@link NsidString} `$type`
   * @param rkey - The record key
   * @param options - Put options including repo, swapCommit, swapRecord, validate
   *
   * @see {@link put} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async putRecord(
    record: TypedLexMap<NsidString>,
    rkey: string,
    { service = null, labelers = null, ...options }: PutRecordOptions = {},
  ) {
    return this.xrpc(putRecord, {
      ...options,
      service,
      labelers,
      body: {
        repo: options?.repo ?? this.assertDid,
        collection: record.$type,
        rkey,
        record,
        validate: options?.validate,
        swapCommit: options?.swapCommit,
        swapRecord: options?.swapRecord,
      },
    })
  }

  /**
   * Lists records in a collection.
   *
   * @param nsid - The collection NSID
   * @param options - List options including repo, limit, cursor, reverse
   *
   * @see {@link list} for a higher-level typed alternative
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async listRecords(
    nsid: NsidString,
    { service = null, labelers = null, ...options }: ListRecordsOptions = {},
  ) {
    return this.xrpc(listRecords, {
      ...options,
      service,
      labelers,
      params: {
        repo: options?.repo ?? this.assertDid,
        collection: nsid,
        cursor: options?.cursor,
        limit: options?.limit,
        reverse: options?.reverse,
      },
    })
  }

  /**
   * Performs an atomic batch of create, update, and delete operations on records in a repository.
   *
   * @param builder - A function that receives an {@link ApplyWritesOperations} instance to build the operations
   * @param options - ApplyWrites options including repo, validate, swapCommit
   * @returns The XRPC response from the applyWrites call
   *
   * @example
   * ```typescript
   * const response = await client.applyWrites((op) => [
   *   op.create(app.bsky.feed.post, { text: 'Hello!' }),
   *   op.update(app.bsky.feed.post, { text: 'Updated text' }, { rkey: 'post123' }),
   *   op.delete(app.bsky.feed.post, 'post456'),
   *   op.update(app.bsky.actor.profile, { displayName: 'Alice' }),
   * ], {
   *   validate: true,
   * })
   *
   * for (const result of response.body.results) {
   *   console.log(result.uri)
   * }
   * ```
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async applyWrites(
    factory: WriteOperationsFactory,
    { service = null, labelers = null, ...options }: ApplyWritesOptions = {},
  ) {
    return this.xrpc(applyWrites, {
      ...options,
      service,
      labelers,
      body: {
        repo: options?.repo ?? this.assertDid,
        writes: WriteOperationHelper.build(factory),
        validate: options?.validate,
        swapCommit: options?.swapCommit,
      },
    })
  }

  /**
   * Uploads a blob to an AT Protocol repository.
   *
   * @param body - The blob data (Uint8Array, ReadableStream, Blob, etc.)
   * @param options - Upload options including encoding hint
   * @returns Response containing the blob reference
   *
   * @example
   * ```typescript
   * const imageData = await fetch('image.png').then(r => r.arrayBuffer())
   * const response = await client.uploadBlob(new Uint8Array(imageData), {
   *   encoding: 'image/png'
   * })
   * console.log(response.body.blob) // Use this ref in records
   * ```
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async uploadBlob(
    body: BinaryBodyInit,
    { service = null, labelers = null, ...options }: UploadBlobOptions = {},
  ) {
    return this.xrpc(uploadBlob, { ...options, service, labelers, body })
  }

  /**
   * Retrieves a blob by DID and CID.
   *
   * @param did - The DID of the repository containing the blob
   * @param cid - The CID of the blob
   * @param options - Call options
   *
   * @note This method will ignore the `service` and `labelers` instance wide
   * defaults, and will always use `null` unless explicitly overridden in the
   * options.
   */
  async getBlob(
    did: DidString,
    cid: CidString,
    { service = null, labelers = null, ...options }: GetBlobOptions = {},
  ) {
    return this.xrpc(getBlob, {
      ...options,
      service,
      labelers,
      params: { did, cid },
    })
  }

  /**
   * Universal call method for queries, procedures, and custom actions.
   * Automatically determines the call type based on the lexicon definition.
   *
   * @param ns - The lexicon method or action definition
   * @param arg - The input argument (params for queries, body for procedures, input for actions)
   * @param options - Call options
   * @returns The method response body or action output
   * @see {@link xrpc} if you need access to the full response object
   *
   * @example Query
   * ```typescript
   * const profile = await client.call(app.bsky.actor.getProfile, {
   *   actor: 'alice.bsky.social'
   * })
   * ```
   *
   * @example Procedure
   * ```typescript
   * const result = await client.call(com.atproto.repo.createRecord, {
   *   repo: did,
   *   collection: 'app.bsky.feed.post',
   *   record: { text: 'Hello!' }
   * })
   * ```
   *
   * @example Action
   * ```typescript
   * const result = await client.call(updateProfile, (profile) => {
   *   profile.displayName = 'Alice'
   * })
   * ```
   */
  public async call<const T extends Query>(
    ns: NonNullable<unknown> extends XrpcRequestParams<T>
      ? Main<T>
      : Restricted<'This query type requires a "params" argument'>,
  ): Promise<XrpcResponseBody<T>>
  public async call<const T extends Procedure>(
    ns: undefined extends InferMethodInputBody<T, Uint8Array>
      ? Main<T>
      : Restricted<'This procedure type requires an "input" argument'>,
  ): Promise<XrpcResponseBody<T>>
  public async call<const T extends Action>(
    ns: void extends InferActionInput<T>
      ? Main<T>
      : Restricted<'This action type requires an "input" argument'>,
  ): Promise<InferActionOutput<T>>
  public async call<const T extends Action | Procedure | Query>(
    ns: Main<T>,
    arg: T extends Action
      ? InferActionInput<T>
      : T extends Procedure
        ? InferMethodInputBody<T, Uint8Array>
        : T extends Query
          ? XrpcRequestParams<T>
          : never,
    options?: T extends Action
      ? ActionOptions
      : T extends Procedure
        ? Omit<XrpcOptions<T>, 'body'>
        : T extends Query
          ? Omit<XrpcOptions<T>, 'params'>
          : never,
  ): Promise<
    T extends Action
      ? InferActionOutput<T>
      : T extends Procedure
        ? XrpcResponseBody<T>
        : T extends Query
          ? XrpcResponseBody<T>
          : never
  >
  public async call(
    ns: Main<Action> | Main<Procedure> | Main<Query>,
    arg?: LexValue | Params,
    options: ActionOptions = {},
  ): Promise<unknown> {
    const method = getMain(ns)

    if (typeof method === 'function') {
      return method(this, arg, options)
    }

    if (method instanceof Procedure) {
      const result = await this.xrpc(method, { ...options, body: arg as any })
      return result.body
    } else if (method instanceof Query) {
      const result = await this.xrpc(method, { ...options, params: arg as any })
      return result.body
    } else {
      throw new TypeError('Invalid lexicon')
    }
  }

  /**
   * Creates a new record with full type safety based on the schema.
   *
   * @param ns - The record schema definition
   * @param input - The record data (without `$type`, which is added automatically)
   * @param options - Create options including rkey (required for some record types)
   * @returns The create output including URI and CID
   *
   * @example Creating a post
   * ```typescript
   * const result = await client.create(app.bsky.feed.post, {
   *   text: 'Hello, world!',
   *   createdAt: new Date().toISOString()
   * })
   * console.log(result.uri)
   * ```
   *
   * @example Creating a record with explicit rkey
   * ```typescript
   * const result = await client.create(app.bsky.actor.profile, {
   *   displayName: 'Alice'
   * }, { rkey: 'self' })
   * ```
   *
   * @see {@link createRecord} for a lower-level method that returns the raw response without schema validation
   */
  public async create<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends CreateOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<Infer<T>, '$type'>,
  ): Promise<CreateOutput>
  public async create<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<Infer<T>, '$type'>,
    options: CreateOptions<T>,
  ): Promise<CreateOutput>
  public async create<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<Infer<T>, '$type'>,
    options: CreateOptions<T> = {} as CreateOptions<T>,
  ): Promise<CreateOutput> {
    const schema: T = getMain(ns)
    const record = schema.build(input) as TypedLexMap<NsidString>
    if (options?.validateRequest) schema.validate(record)
    const rkey = options.rkey ?? getDefaultRecordKey(schema)
    if (rkey !== undefined) schema.keySchema.assert(rkey)
    const response = await this.createRecord(record, rkey, options)
    return response.body
  }

  /**
   * Deletes a record with type-safe options.
   *
   * @param ns - The record schema definition
   * @param options - Delete options (rkey required for non-literal keys)
   * @returns The delete output
   *
   * @see {@link deleteRecord} for a lower-level method that returns the raw response without schema validation
   */
  public async delete<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends DeleteOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
  ): Promise<DeleteOutput>
  public async delete<const T extends RecordSchema>(
    ns: Main<T>,
    options?: DeleteOptions<T>,
  ): Promise<DeleteOutput>
  public async delete<const T extends RecordSchema>(
    ns: Main<T>,
    options: DeleteOptions<T> = {} as DeleteOptions<T>,
  ): Promise<DeleteOutput> {
    const schema = getMain(ns)
    const rkey = schema.keySchema.parse(
      options.rkey ?? getLiteralRecordKey(schema),
    )
    const response = await this.deleteRecord(schema.$type, rkey, options)
    return response.body
  }

  /**
   * Retrieves a record with type-safe validation.
   *
   * @param ns - The record schema definition
   * @param options - Get options (rkey required for non-literal keys)
   * @returns The record data validated against the schema
   *
   * @example
   * ```typescript
   * const profile = await client.get(app.bsky.actor.profile)
   * // profile.value is typed as app.bsky.actor.profile.Record
   * console.log(profile.value.displayName)
   * ```
   *
   * @see {@link getRecord} for a lower-level method that returns the raw record without schema validation
   */
  public async get<const T extends RecordSchema>(
    ns: T['key'] extends `literal:${string}`
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
  ): Promise<GetOutput<T>>
  public async get<const T extends RecordSchema>(
    ns: Main<T>,
    options: GetOptions<T>,
  ): Promise<GetOutput<T>>
  public async get<const T extends RecordSchema>(
    ns: Main<T>,
    options: GetOptions<T> = {} as GetOptions<T>,
  ): Promise<GetOutput<T>> {
    const schema = getMain(ns)
    const rkey = schema.keySchema.parse(
      options.rkey ?? getLiteralRecordKey(schema),
    )
    const response = await this.getRecord(schema.$type, rkey, options)
    const value = schema.validate(response.body.value)
    return { ...response.body, value }
  }

  /**
   * Creates or updates a record with full type safety.
   *
   * @param ns - The record schema definition
   * @param input - The record data
   * @param options - Put options (rkey required for non-literal keys)
   * @returns The put output including URI and CID
   *
   * @example Creating a new record
   * ```typescript
   * const result = await client.put(app.bsky.feed.post, {
   *   text: 'Hello, world!',
   *   createdAt: new Date().toISOString()
   * })
   * console.log(result.uri)
   * ```
   *
   * @example Updating an existing record with explicit rkey
   * ```typescript
   * const result = await client.put(app.bsky.actor.profile, {
   *   displayName: 'Alice'
   * }, { rkey: 'self' })
   * ```
   *
   * @see {@link putRecord} for a lower-level method that returns the raw record without schema validation
   */
  public async put<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends PutOptions<T>
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<Infer<T>, '$type'>,
  ): Promise<PutOutput>
  public async put<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<Infer<T>, '$type'>,
    options: PutOptions<T>,
  ): Promise<PutOutput>
  public async put<const T extends RecordSchema>(
    ns: Main<T>,
    input: Omit<Infer<T>, '$type'>,
    options: PutOptions<T> = {} as PutOptions<T>,
  ): Promise<PutOutput> {
    const schema: T = getMain(ns)
    const record = schema.build(input) as TypedLexMap<NsidString>
    if (options?.validateRequest) schema.validate(record)
    const rkey = options.rkey ?? getLiteralRecordKey(schema)
    const response = await this.putRecord(record, rkey, options)
    return response.body
  }

  /**
   * Lists records with type-safe validation and separation of valid/invalid records.
   *
   * @param ns - The record schema definition
   * @param options - List options
   * @returns Records validated against the schema, with invalid records included as LexMap
   *
   * @example
   * ```typescript
   * const result = await client.list(app.bsky.feed.post, { limit: 100 })
   * for (const record of result.records) {
   *   if (record.valid) {
   *     record.value // Fully typed
   *   } else {
   *     record.value // Invalid record, typed as LexMap
   *   }
   * }
   * ```
   *
   * @see {@link listRecords} for a lower-level method that returns the raw records without schema validation
   */
  async list<const T extends RecordSchema>(
    ns: Main<T>,
    options?: ListOptions,
  ): Promise<ListOutput<T>> {
    const schema = getMain(ns)
    const { body } = await this.listRecords(schema.$type, options)
    const records = body.records.map(processListRecord, schema)
    return { ...body, records }
  }

  /**
   * Asynchronously iterates over all records in a collection, handling
   * pagination automatically.
   *
   * @param ns - The record schema definition
   * @param options - List options including limit and cursor
   * @returns An async generator yielding each record validated against the schema
   *
   * @see {@link list} for a method that returns a single page of records
   * @see {@link listRecords} for a lower-level method that returns raw records without schema validation
   */
  async *listAll<const T extends RecordSchema>(
    ns: Main<T>,
    { maxRetries = 3, ...options }: ListOptions = {},
  ): AsyncGenerator<ListRecordItem<Infer<T>>, void, unknown> {
    const schema = getMain(ns)

    do {
      options.signal?.throwIfAborted()

      const { body } = await this.listRecords(schema.$type, {
        ...options,
        maxRetries,
      })

      // We don't use this.list() here so that we can lazily process records as
      // they come in, rather than mapping and yielding the entire page at once.
      for (const record of body.records) {
        yield processListRecord.call(schema, record)
      }

      // If the server returns the same cursor, we may be in a loop. Stop
      // iteration.
      if (body.cursor && body.cursor === options.cursor) {
        return
      }

      options.cursor = body.cursor
    } while (options.cursor)
  }
}

function processListRecord<T extends RecordSchema>(
  this: T,
  record: ListRecordsRecord,
): ListRecordItem<Infer<T>> {
  const result = this.safeValidate(record.value)
  if (result.success) {
    return { ...record, valid: true, value: result.value }
  } else {
    return { ...record, valid: false }
  }
}
