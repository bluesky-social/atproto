import { LexError, LexMap, LexValue } from '@atproto/lex-data'
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
  UnknownObject,
  getMain,
} from '@atproto/lex-schema'
import { Agent, AgentOptions, buildAgent } from './agent.js'
import { com } from './lexicons/index.js'
import { XrpcResponse, XrpcResponseBody } from './response.js'
import { BinaryBodyInit, CallOptions, Service } from './types.js'
import { buildAtprotoHeaders } from './util.js'
import {
  XrpcFailure,
  XrpcOptions,
  XrpcRequestParams,
  xrpc,
  xrpcSafe,
} from './xrpc.js'

export type {
  AtIdentifierString,
  CidString,
  DidString,
  InferMethodInputBody,
  InferMethodOutputBody,
  InferRecordKey,
  LexMap,
  LexValue,
  LexiconRecordKey,
  NsidString,
  Params,
  Procedure,
  Query,
  RecordSchema,
  Restricted,
}

export type ClientOptions = {
  labelers?: Iterable<DidString>
  headers?: HeadersInit
  service?: Service
}

export type Action<I = any, O = any> = (
  client: Client,
  input: I,
  options: CallOptions,
) => O | Promise<O>
export type InferActionInput<A extends Action> =
  A extends Action<infer I, any> ? I : never
export type InferActionOutput<A extends Action> =
  A extends Action<any, infer O> ? O : never

export type CreateRecordOptions = CallOptions & {
  repo?: AtIdentifierString
  swapCommit?: string
  validate?: boolean
}

export type DeleteRecordOptions = CallOptions & {
  repo?: AtIdentifierString
  swapCommit?: string
  swapRecord?: string
}

export type GetRecordOptions = CallOptions & {
  repo?: AtIdentifierString
}

export type PutRecordOptions = CallOptions & {
  repo?: AtIdentifierString
  swapCommit?: string
  swapRecord?: string
  validate?: boolean
}

export type ListRecordsOptions = CallOptions & {
  repo?: AtIdentifierString
  limit?: number
  cursor?: string
  reverse?: boolean
}

export type RecordKeyOptions<
  T extends RecordSchema,
  AlsoOptionalWhenRecordKeyIs extends LexiconRecordKey = never,
> = T['key'] extends `literal:${string}` | AlsoOptionalWhenRecordKeyIs
  ? { rkey?: InferRecordKey<T> }
  : { rkey: InferRecordKey<T> }

export type CreateOptions<T extends RecordSchema> = CreateRecordOptions &
  RecordKeyOptions<T, 'tid'>
export type CreateOutput = InferMethodOutputBody<
  typeof com.atproto.repo.createRecord.main,
  Uint8Array
>

export type DeleteOptions<T extends RecordSchema> = DeleteRecordOptions &
  RecordKeyOptions<T>
export type DeleteOutput = InferMethodOutputBody<
  typeof com.atproto.repo.deleteRecord.main,
  Uint8Array
>
export type GetOptions<T extends RecordSchema> = GetRecordOptions &
  RecordKeyOptions<T>
export type GetOutput<T extends RecordSchema> = Omit<
  InferMethodOutputBody<typeof com.atproto.repo.getRecord.main, Uint8Array>,
  'value'
> & { value: Infer<T> }

export type PutOptions<T extends RecordSchema> = PutRecordOptions &
  RecordKeyOptions<T>
export type PutOutput = InferMethodOutputBody<
  typeof com.atproto.repo.putRecord.main,
  Uint8Array
>

export type ListOptions = ListRecordsOptions
export type ListOutput<T extends RecordSchema> = InferMethodOutputBody<
  typeof com.atproto.repo.listRecords.main,
  Uint8Array
> & {
  records: ListRecord<Infer<T>>[]
  // @NOTE Because the schema uses "type": "unknown" instead of an open union,
  // we have to use UnknownObject instead of Unknown$TypedObject here.
  invalid: UnknownObject[]
}
export type ListRecord<Value extends LexMap> =
  com.atproto.repo.listRecords.Record & {
    value: Value
  }

export class Client implements Agent {
  static appLabelers: readonly DidString[] = []

  /**
   * Configures the Client (or its sub classes) globally.
   */
  static configure(opts: { appLabelers?: Iterable<DidString> }) {
    if (opts.appLabelers) this.appLabelers = [...opts.appLabelers]
  }

  public readonly agent: Agent
  public readonly headers: Headers
  public readonly service?: Service
  public readonly labelers: Set<DidString>

  constructor(agent: Agent | AgentOptions, options: ClientOptions = {}) {
    this.agent = buildAgent(agent)
    this.service = options.service
    this.labelers = new Set(options.labelers)
    this.headers = new Headers(options.headers)
  }

  get did(): DidString | undefined {
    return this.agent.did
  }

  get assertDid(): DidString {
    this.assertAuthenticated()
    return this.did
  }

  public assertAuthenticated(): asserts this is { did: DidString } {
    if (!this.did) throw new LexError('AuthenticationRequired')
  }

  public setLabelers(labelers: Iterable<DidString> = []) {
    this.clearLabelers()
    this.addLabelers(labelers)
  }

  public addLabelers(labelers: Iterable<DidString>) {
    for (const labeler of labelers) this.labelers.add(labeler)
  }

  public clearLabelers() {
    this.labelers.clear()
  }

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
   * @throws {XrpcFailure<M>} when the request fails or the response is an error
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
   * @param rkey Leave `undefined` to have the server generate a TID.
   */
  public async createRecord(
    record: { $type: NsidString } & LexMap,
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

  async putRecord(
    record: { $type: NsidString } & LexMap,
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

  async uploadBlob(
    body: BinaryBodyInit,
    options?: CallOptions & { encoding?: `${string}/${string}` },
  ) {
    return this.xrpc(com.atproto.repo.uploadBlob.main, {
      ...options,
      body,
    })
  }

  async getBlob(did: DidString, cid: CidString, options?: CallOptions) {
    return this.xrpc(com.atproto.sync.getBlob.main, {
      ...options,
      params: { did, cid },
    })
  }

  public async call<const T extends Query>(
    ns: NonNullable<unknown> extends XrpcRequestParams<T>
      ? Main<T>
      : Restricted<'This query type requires a "params" argument'>,
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
    const record = schema.build(input) as { $type: NsidString } & LexMap
    const rkey = options.rkey ?? getDefaultRecordKey(schema)
    if (rkey !== undefined) schema.keySchema.assert(rkey)
    const response = await this.createRecord(record, rkey, options)
    return response.body
  }

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
    const record = schema.build(input) as { $type: NsidString } & LexMap
    const rkey = options.rkey ?? getLiteralRecordKey(schema)
    const response = await this.putRecord(record, rkey, options)
    return response.body
  }

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
    return schema.key.slice(8)
  }

  throw new TypeError(
    `An "rkey" must be provided for record key type "${schema.key}" (${schema.$type})`,
  )
}
