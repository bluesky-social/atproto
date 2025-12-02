import { LexMap, LexValue } from '@atproto/lex-data'
import {
  AtIdentifierString,
  DidString,
  Infer,
  InferProcedureInputBody,
  InferProcedureOutputBody,
  InferQueryOutputBody,
  InferQueryParameters,
  InferRecordKey,
  LexiconRecordKey,
  NsidString,
  Params,
  Procedure,
  Query,
  RecordSchema,
  Restricted,
  Schema,
} from '@atproto/lex-schema'
import { Agent, AgentOptions, buildAgent } from './agent.js'
import {
  KnownError,
  XrpcError,
  XrpcRequestFailure,
  asXrpcRequestFailureFor,
} from './error.js'
import * as com from './lexicons/com.js'
import { XrpcResponse, XrpcResponseBody } from './response.js'
import { CallOptions, Namespace, Service, getMain } from './types.js'
import { XrpcOptions, xrpc, xrpcRequestHeaders } from './xrpc.js'

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
export type CreateOutput = XrpcResponseBody<
  typeof com.atproto.repo.createRecord.main
>

export type DeleteOptions<T extends RecordSchema> = DeleteRecordOptions &
  RecordKeyOptions<T>
export type DeleteOutput = XrpcResponseBody<
  typeof com.atproto.repo.deleteRecord.main
>
export type GetOptions<T extends RecordSchema> = GetRecordOptions &
  RecordKeyOptions<T>
export type GetOutput<T extends RecordSchema> = Omit<
  XrpcResponseBody<typeof com.atproto.repo.getRecord.main>,
  'value'
> & { value: Infer<T> }

export type PutOptions<T extends RecordSchema> = PutRecordOptions &
  RecordKeyOptions<T>
export type PutOutput = XrpcResponseBody<typeof com.atproto.repo.putRecord.main>

export type ListOptions = ListRecordsOptions
export type ListOutput<T extends RecordSchema> = XrpcResponseBody<
  typeof com.atproto.repo.listRecords.main
> & {
  records: ListRecord<T>[]
  // @NOTE Because the schema uses "type": "unknown" instead of an open union,
  // we have to use LexMap instead of TypedObject here.
  invalid: LexMap[]
}
export type ListRecord<T extends RecordSchema> =
  com.atproto.repo.listRecords.DefRecord & {
    value: Infer<T>
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
    this.agent =
      typeof agent === 'object' && 'fetchHandler' in agent
        ? agent
        : buildAgent(agent)
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
    if (!this.did) throw new XrpcError(KnownError.AuthenticationRequired)
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
    const headers = xrpcRequestHeaders({
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

    return this.agent.fetchHandler(path, { ...init, headers })
  }

  async xrpc<const M extends Query | Procedure>(
    ns: NonNullable<unknown> extends XrpcOptions<M>
      ? Namespace<M>
      : Restricted<'This XRPC method requires an "options" argument'>,
  ): Promise<XrpcResponse<M>>
  async xrpc<const M extends Query | Procedure>(
    ns: Namespace<M>,
    options: XrpcOptions<M>,
  ): Promise<XrpcResponse<M>>
  async xrpc<const M extends Query | Procedure>(
    ns: Namespace<M>,
    options: XrpcOptions<M> = {} as XrpcOptions<M>,
  ): Promise<XrpcResponse<M>> {
    return xrpc(this, ns, options)
  }

  async xrpcSafe<const M extends Query | Procedure>(
    ns: NonNullable<unknown> extends XrpcOptions<M>
      ? Namespace<M>
      : Restricted<'This XRPC method requires an "options" argument'>,
  ): Promise<XrpcResponse<M> | XrpcRequestFailure<M>>
  async xrpcSafe<const M extends Query | Procedure>(
    ns: Namespace<M>,
    options: XrpcOptions<M>,
  ): Promise<XrpcResponse<M> | XrpcRequestFailure<M>>
  async xrpcSafe<const M extends Query | Procedure>(
    ns: Namespace<M>,
    options: XrpcOptions<M> = {} as XrpcOptions<M>,
  ): Promise<unknown> {
    const schema = getMain(ns)
    return this.xrpc(schema, options).catch(asXrpcRequestFailureFor(schema))
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

  async createRecordsSafe(...args: Parameters<Client['createRecord']>) {
    return this.createRecord(...args).catch(
      asXrpcRequestFailureFor(com.atproto.repo.createRecord.main),
    )
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

  async deleteRecordsSafe(...args: Parameters<Client['deleteRecord']>) {
    return this.deleteRecord(...args).catch(
      asXrpcRequestFailureFor(com.atproto.repo.deleteRecord.main),
    )
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

  async getRecordsSafe(...args: Parameters<Client['getRecord']>) {
    return this.getRecord(...args).catch(
      asXrpcRequestFailureFor(com.atproto.repo.getRecord.main),
    )
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

  async putRecordsSafe(...args: Parameters<Client['putRecord']>) {
    return this.putRecord(...args).catch(
      asXrpcRequestFailureFor(com.atproto.repo.putRecord.main),
    )
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

  public async call<const T extends Action>(
    ns: Namespace<T>,
    input: InferActionInput<T>,
    options?: CallOptions,
  ): Promise<InferActionOutput<T>>
  public async call<const T extends Procedure>(
    ns: Namespace<T>,
    body: InferProcedureInputBody<T>,
    options?: CallOptions,
  ): Promise<InferProcedureOutputBody<T>>
  public async call<const T extends Query>(
    ns: NonNullable<unknown> extends InferQueryParameters<T>
      ? Namespace<T>
      : Restricted<'This query type requires a "params" argument'>,
  ): Promise<InferQueryOutputBody<T>>
  public async call<const T extends Query>(
    ns: Namespace<T>,
    params: NonNullable<unknown> extends InferQueryParameters<T>
      ? InferQueryParameters<T> | undefined
      : InferQueryParameters<T>,
    options?: CallOptions,
  ): Promise<InferQueryOutputBody<T>>
  public async call(
    ns: Namespace<Action> | Namespace<Procedure> | Namespace<Query>,
    arg?: LexValue | Params,
    options: CallOptions = {},
  ): Promise<unknown> {
    const method = getMain(ns)

    if (typeof method === 'function') {
      return method(this, arg, options)
    }

    if (method instanceof Procedure) {
      const body = arg as LexValue | undefined
      const result = await this.xrpc(method, { ...options, body })
      return result.body
    } else if (method instanceof Query) {
      const params = arg as Params | undefined
      const result = await this.xrpc(method, { ...options, params })
      return result.body
    } else {
      throw new TypeError('Invalid lexicon')
    }
  }

  public async create<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends CreateOptions<T>
      ? Namespace<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<Infer<T>, '$type'>,
  ): Promise<CreateOutput>
  public async create<const T extends RecordSchema>(
    ns: Namespace<T>,
    input: Omit<Infer<T>, '$type'>,
    options: CreateOptions<T>,
  ): Promise<CreateOutput>
  public async create<const T extends RecordSchema>(
    ns: Namespace<T>,
    input: Omit<Infer<T>, '$type'>,
    options: CreateOptions<T> = {} as CreateOptions<T>,
  ): Promise<CreateOutput> {
    const schema: T = getMain(ns)
    const record = options.validate
      ? schema.parse(schema.build(input))
      : schema.build(input)
    const rkey = options.rkey ?? getDefaultRecordKey(schema)
    if (rkey !== undefined) schema.keySchema.assert(rkey)
    const response = await this.createRecord(record, rkey, options)
    return response.body
  }

  public async delete<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends DeleteOptions<T>
      ? Namespace<T>
      : Restricted<'This record type requires an "options" argument'>,
  ): Promise<DeleteOutput>
  public async delete<const T extends RecordSchema>(
    ns: Namespace<T>,
    options?: DeleteOptions<T>,
  ): Promise<DeleteOutput>
  public async delete<const T extends RecordSchema>(
    ns: Namespace<T>,
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
      ? Namespace<T>
      : Restricted<'This record type requires an "options" argument'>,
  ): Promise<GetOutput<T>>
  public async get<const T extends RecordSchema>(
    ns: Namespace<T>,
    options?: GetOptions<T>,
  ): Promise<GetOutput<T>>
  public async get<const T extends RecordSchema>(
    ns: Namespace<T>,
    options: GetOptions<T> = {} as GetOptions<T>,
  ): Promise<GetOutput<T>> {
    const schema = getMain(ns)
    const rkey = schema.keySchema.parse(
      options.rkey ?? getLiteralRecordKey(schema),
    )
    const response = await this.getRecord(schema.$type, rkey, options)
    const value = schema.parse(response.body.value) as Infer<T>
    return { ...response.body, value }
  }

  public async put<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends PutOptions<T>
      ? Namespace<T>
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<Infer<T>, '$type'>,
  ): Promise<PutOutput>
  public async put<const T extends RecordSchema>(
    ns: Namespace<T>,
    input: Omit<Infer<T>, '$type'>,
    options: PutOptions<T>,
  ): Promise<PutOutput>
  public async put<const T extends RecordSchema>(
    ns: Namespace<T>,
    input: Omit<Infer<T>, '$type'>,
    options: PutOptions<T> = {} as PutOptions<T>,
  ): Promise<PutOutput> {
    const schema = getMain(ns)
    const record = schema.build(input)
    const rkey = options.rkey ?? getLiteralRecordKey(schema)
    const response = await this.putRecord(record, rkey, options)
    return response.body
  }

  async list<const T extends RecordSchema>(
    ns: Namespace<T>,
    options?: ListOptions,
  ): Promise<ListOutput<T>> {
    const schema = getMain(ns)
    const { body } = await this.listRecords(schema.$type, options)

    const records: ListRecord<T>[] = []
    const invalid: LexMap[] = []

    for (const record of body.records) {
      const parsed = (schema as Schema<Infer<T>>).safeParse(record.value)
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
