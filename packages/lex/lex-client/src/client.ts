import { LexError, LexMap, LexValue, TypedLexMap } from '@atproto/lex-data'
import {
  AtIdentifierString,
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
  Procedure,
  Query,
  RecordSchema,
  Restricted,
  getMain,
} from '@atproto/lex-schema'
import { Agent, AgentOptions, buildAgent } from './agent.js'
import { XrpcFailure } from './errors.js'
import { com } from './lexicons/index.js'
import { XrpcResponse, XrpcResponseBody } from './response.js'
import { BinaryBodyInit, CallOptions, Service } from './types.js'
import { buildAtprotoHeaders } from './util.js'
import { XrpcOptions, XrpcRequestParams, xrpc, xrpcSafe } from './xrpc.js'

export type {
  AtIdentifierString,
  CidString,
  DidString,
  Infer,
  InferMethodInputBody,
  InferMethodOutputBody,
  InferRecordKey,
  LexMap,
  LexValue,
  LexiconRecordKey,
  Main,
  NsidString,
  Params,
  Procedure,
  Query,
  RecordSchema,
  Restricted,
  TypedLexMap,
}

/**
 * Configuration options for creating a {@link Client}.
 *
 * @example
 * ```typescript
 * const options: ClientOptions = {
 *   labelers: ['did:plc:labeler1'],
 *   service: 'did:web:api.bsky.app#bsky_appview',
 *   headers: { 'X-Custom-Header': 'value' }
 * }
 * ```
 */
export type ClientOptions = {
  /** Labeler DIDs to include in requests for content moderation. */
  labelers?: Iterable<DidString>
  /** Custom headers to include in all requests made by this client. */
  headers?: HeadersInit
  /** Service proxy identifier for routing requests through a specific service. */
  service?: Service
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
  options: CallOptions,
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
export type CreateRecordOptions = CallOptions & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
  /** Compare-and-swap on the repo commit. If specified, must match current commit. */
  swapCommit?: string
  /** Whether to validate the record against its lexicon schema. */
  validate?: boolean
}

/**
 * Options for deleting a record from an AT Protocol repository.
 *
 * @see {@link Client.deleteRecord}
 */
export type DeleteRecordOptions = CallOptions & {
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
export type GetRecordOptions = CallOptions & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
}

/**
 * Options for creating or updating a record in an AT Protocol repository.
 *
 * @see {@link Client.putRecord}
 */
export type PutRecordOptions = CallOptions & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
  /** Compare-and-swap on the repo commit. If specified, must match current commit. */
  swapCommit?: string
  /** Compare-and-swap on the record CID. If specified, must match current record. */
  swapRecord?: string
  /** Whether to validate the record against its lexicon schema. */
  validate?: boolean
}

/**
 * Options for listing records in an AT Protocol repository collection.
 *
 * @see {@link Client.listRecords}
 */
export type ListRecordsOptions = CallOptions & {
  /** Repository identifier (DID or handle). Defaults to authenticated user's DID. */
  repo?: AtIdentifierString
  /** Maximum number of records to return. */
  limit?: number
  /** Pagination cursor from a previous response. */
  cursor?: string
  /** If true, returns records in reverse chronological order. */
  reverse?: boolean
}

export type RecordKeyOptions<
  T extends RecordSchema,
  AlsoOptionalWhenRecordKeyIs extends LexiconRecordKey = never,
> = T['key'] extends `literal:${string}` | AlsoOptionalWhenRecordKeyIs
  ? { rkey?: InferRecordKey<T> }
  : { rkey: InferRecordKey<T> }

/**
 * Type-safe options for {@link Client.create}, combining record options with key requirements.
 * @typeParam T - The record schema type
 */
export type CreateOptions<T extends RecordSchema> = CreateRecordOptions &
  RecordKeyOptions<T, 'tid' | 'any'>

/**
 * Output type for record creation operations.
 * Contains the URI and CID of the newly created record.
 */
export type CreateOutput = InferMethodOutputBody<
  typeof com.atproto.repo.createRecord.main,
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
  typeof com.atproto.repo.deleteRecord.main,
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
  InferMethodOutputBody<typeof com.atproto.repo.getRecord.main, Uint8Array>,
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
export type PutOutput = InferMethodOutputBody<
  typeof com.atproto.repo.putRecord.main,
  Uint8Array
>

/**
 * Options for {@link Client.list} operations.
 */
export type ListOptions = ListRecordsOptions

/**
 * Output type for record listing operations.
 * Contains validated records and any invalid records that failed schema validation.
 * @typeParam T - The record schema type
 */
export type ListOutput<T extends RecordSchema> = InferMethodOutputBody<
  typeof com.atproto.repo.listRecords.main,
  Uint8Array
> & {
  /** Records that successfully validated against the schema. */
  records: ListRecord<Infer<T>>[]
  // @NOTE Because the schema uses "type": "unknown" instead of an open union,
  // we have to use LexMap instead of Unknown$TypedObject here, which is
  // unfortunate.
  /** Records that failed schema validation. */
  invalid: LexMap[]
}

/**
 * A record from a list operation with its value typed to the schema.
 * @typeParam Value - The validated record value type
 */
export type ListRecord<Value extends LexMap> =
  com.atproto.repo.listRecords.Record & {
    value: Value
  }

/**
 * The Client class is the primary interface for interacting with AT Protocol
 * services. It provides type-safe methods for XRPC calls, record operations,
 * and blob handling.
 *
 * @example Basic usage
 * ```typescript
 * import { Client } from '@atproto/lex'
 *
 * const client = new Client(agent)
 * const response = await client.xrpc(app.bsky.feed.getTimeline.main, {
 *   params: { limit: 50 }
 * })
 * ```
 */
export class Client implements Agent {
  static appLabelers: readonly DidString[] = []

  /**
   * Configures the Client (or its sub classes) globally.
   */
  static configure(opts: { appLabelers?: Iterable<DidString> }) {
    if (opts.appLabelers) this.appLabelers = [...opts.appLabelers]
  }

  /** The underlying agent used for making requests. */
  public readonly agent: Agent

  /** Custom headers included in all requests. */
  public readonly headers: Headers

  /** Optional service identifier for routing requests. */
  public readonly service?: Service

  /** Set of labeler DIDs specific to this client instance. */
  public readonly labelers: Set<DidString>

  constructor(agent: Agent | AgentOptions, options: ClientOptions = {}) {
    this.agent = buildAgent(agent)
    this.service = options.service
    this.labelers = new Set(options.labelers)
    this.headers = new Headers(options.headers)
  }

  /**
   * The DID of the authenticated user, or `undefined` if not authenticated.
   */
  get did(): DidString | undefined {
    return this.agent.did
  }

  /**
   * The DID of the authenticated user.
   * @throws {LexError} with code 'AuthenticationRequired' if not authenticated
   */
  get assertDid(): DidString {
    this.assertAuthenticated()
    return this.did
  }

  /**
   * Asserts that the client is authenticated.
   * Use as a type guard when you need to ensure authentication.
   *
   * @throws {LexError} with code 'AuthenticationRequired' if not authenticated
   *
   * @example
   * ```typescript
   * client.assertAuthenticated()
   * // TypeScript now knows client.did is defined
   * console.log(client.did)
   * ```
   */
  public assertAuthenticated(): asserts this is { did: DidString } {
    if (!this.did) throw new LexError('AuthenticationRequired')
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
    for (const labeler of labelers) this.labelers.add(labeler)
  }

  /**
   * Removes all labelers from this client instance.
   */
  public clearLabelers() {
    this.labelers.clear()
  }

  /**
   * Low-level fetch handler for making requests.
   * @param path - The request path
   * @param init - Request initialization options
   */
  public fetchHandler(path: string, init: RequestInit): Promise<Response> {
    const headers = buildAtprotoHeaders({
      headers: init.headers,
      service: this.service,
      labelers: [
        ...(this.constructor as typeof Client).appLabelers.map(
          (l) => `${l};redact` as const,
        ),
        ...this.labelers,
      ],
    })

    // Incoming headers take precedence
    for (const [key, value] of this.headers) {
      if (!headers.has(key)) headers.set(key, value)
    }

    // @NOTE The agent here could be another Client instance.
    return this.agent.fetchHandler(path, { ...init, headers })
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
    return xrpc(this, ns, options)
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
   * const result = await client.xrpcSafe(app.bsky.actor.getProfile.main, {
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
    return xrpcSafe(this, ns, options)
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
   */
  public async createRecord(
    record: TypedLexMap<NsidString>,
    rkey?: string,
    options?: CreateRecordOptions,
  ) {
    return this.xrpc(com.atproto.repo.createRecord.main, {
      ...options,
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
   */
  async deleteRecord(
    collection: NsidString,
    rkey: string,
    options?: DeleteRecordOptions,
  ) {
    return this.xrpc(com.atproto.repo.deleteRecord.main, {
      ...options,
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
   */
  public async getRecord(
    collection: NsidString,
    rkey: string,
    options?: GetRecordOptions,
  ) {
    return this.xrpc(com.atproto.repo.getRecord.main, {
      ...options,
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
   */
  async putRecord(
    record: TypedLexMap<NsidString>,
    rkey: string,
    options?: PutRecordOptions,
  ) {
    return this.xrpc(com.atproto.repo.putRecord.main, {
      ...options,
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
   */
  async listRecords(nsid: NsidString, options?: ListRecordsOptions) {
    return this.xrpc(com.atproto.repo.listRecords.main, {
      ...options,
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
   */
  async uploadBlob(
    body: BinaryBodyInit,
    options?: CallOptions & { encoding?: `${string}/${string}` },
  ) {
    return this.xrpc(com.atproto.repo.uploadBlob.main, {
      ...options,
      body,
    })
  }

  /**
   * Retrieves a blob by DID and CID.
   *
   * @param did - The DID of the repository containing the blob
   * @param cid - The CID of the blob
   * @param options - Call options
   */
  async getBlob(did: DidString, cid: CidString, options?: CallOptions) {
    return this.xrpc(com.atproto.sync.getBlob.main, {
      ...options,
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
   * const profile = await client.call(app.bsky.actor.getProfile.main, {
   *   actor: 'alice.bsky.social'
   * })
   * ```
   *
   * @example Procedure
   * ```typescript
   * const result = await client.call(com.atproto.repo.createRecord.main, {
   *   repo: did,
   *   collection: 'app.bsky.feed.post',
   *   record: { text: 'Hello!' }
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
    options?: CallOptions,
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
    options: CallOptions = {},
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
   * const result = await client.create(app.bsky.feed.post.main, {
   *   text: 'Hello, world!',
   *   createdAt: new Date().toISOString()
   * })
   * console.log(result.uri)
   * ```
   *
   * @example Creating a record with explicit rkey
   * ```typescript
   * const result = await client.create(app.bsky.actor.profile.main, {
   *   displayName: 'Alice'
   * }, { rkey: 'self' })
   * ```
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
   * const profile = await client.get(app.bsky.actor.profile.main)
   * // profile.value is typed as app.bsky.actor.profile.Record
   * console.log(profile.value.displayName)
   * ```
   */
  public async get<const T extends RecordSchema>(
    ns: T['key'] extends `literal:${string}`
      ? Main<T>
      : Restricted<'This record type requires an "options" argument'>,
  ): Promise<GetOutput<T>>
  public async get<const T extends RecordSchema>(
    ns: Main<T>,
    options?: GetOptions<T>,
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
    const rkey = options.rkey ?? getLiteralRecordKey(schema)
    const response = await this.putRecord(record, rkey, options)
    return response.body
  }

  /**
   * Lists records with type-safe validation and separation of valid/invalid records.
   *
   * @param ns - The record schema definition
   * @param options - List options
   * @returns Records split into valid (matching schema) and invalid arrays
   *
   * @example
   * ```typescript
   * const result = await client.list(app.bsky.feed.post.main, { limit: 100 })
   * console.log(`Found ${result.records.length} valid posts`)
   * console.log(`Found ${result.invalid.length} invalid records`)
   * ```
   */
  async list<const T extends RecordSchema>(
    ns: Main<T>,
    options?: ListOptions,
  ): Promise<ListOutput<T>> {
    const schema = getMain(ns)
    const { body } = await this.listRecords(schema.$type, options)

    const records: ListRecord<Infer<T>>[] = []
    const invalid: LexMap[] = []

    for (const record of body.records) {
      const parsed = schema.safeValidate(record.value)
      if (parsed.success) {
        records.push({ ...record, value: parsed.value })
      } else {
        invalid.push(record.value)
      }
    }

    return { ...body, records, invalid }
  }
}

function getDefaultRecordKey<const T extends RecordSchema>(
  schema: T,
): undefined | InferRecordKey<T> {
  // Let the server generate the TID
  if (schema.key === 'tid') return undefined
  if (schema.key === 'any') return undefined

  return getLiteralRecordKey(schema)
}

function getLiteralRecordKey<const T extends RecordSchema>(
  schema: T,
): InferRecordKey<T> {
  if (schema.key.startsWith('literal:')) {
    return schema.key.slice(8) as InferRecordKey<T>
  }

  throw new TypeError(
    `An "rkey" must be provided for record key type "${schema.key}" (${schema.$type})`,
  )
}
