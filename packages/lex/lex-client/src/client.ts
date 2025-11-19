import { LexMap, LexValue } from '@atproto/lex-data'
import { lexParse, lexStringify } from '@atproto/lex-json'
import {
  AtIdentifier,
  Did,
  Infer,
  InferParamsSchema,
  InferPayloadBody,
  InferPayloadEncoding,
  InferProcedureInputBody,
  InferProcedureOutputBody,
  InferQueryOutputBody,
  InferQueryParameters,
  InferRecordKey,
  Nsid,
  Params,
  ParamsSchema,
  Payload,
  Procedure,
  Query,
  RecordKey,
  RecordSchema,
  Restricted,
  Subscription,
  UnknownString,
  ValidationResult,
} from '@atproto/lex-schema'
import { Agent, AgentOptions, buildAgent } from './agent.js'
import { KnownError, XrpcResponseError, XrpcServiceError } from './error.js'
import * as createRecord from './lexicons/com/atproto/repo/createRecord.defs.js'
import * as deleteRecord from './lexicons/com/atproto/repo/deleteRecord.defs.js'
import * as getRecord from './lexicons/com/atproto/repo/getRecord.defs.js'
import * as listRecords from './lexicons/com/atproto/repo/listRecords.defs.js'
import * as putRecord from './lexicons/com/atproto/repo/putRecord.defs.js'

export type DidServiceIdentifier = 'atproto_labeler' | UnknownString
export type Service = `${Did}#${DidServiceIdentifier}`

export type ClientOptions = {
  labelers?: Iterable<Did>
  headers?: HeadersInit
  service?: Service
}

export type CallOptions = {
  labelers?: Iterable<Did>
  signal?: AbortSignal
  headers?: HeadersInit
  service?: Service
  validateResponse?: boolean
}

export type XrpcOptions<M extends Procedure | Query = Procedure | Query> =
  CallOptions & XrpcRequestUrlOptions<M> & XrpcRequestBodyOptions<M>

export type XrpcOutputEncoding<M extends Procedure | Query> =
  InferPayloadEncoding<M['output']>
export type XrpcOutputBody<M extends Procedure | Query> = InferPayloadBody<
  M['output']
>
export type XrpcOutput<M extends Procedure | Query> = {
  /**
   * Allows for convenient discrimination against {@link ResultFailure}
   */
  success: true

  status: number
  headers: Headers
  encoding: XrpcOutputEncoding<M>
  body: XrpcOutputBody<M>
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
  repo?: AtIdentifier
  swapCommit?: string
  validate?: boolean
}

export type DeleteRecordOptions = CallOptions & {
  repo?: AtIdentifier
  swapCommit?: string
  swapRecord?: string
}

export type GetRecordOptions = CallOptions & {
  repo?: AtIdentifier
}

export type PutRecordOptions = CallOptions & {
  repo?: AtIdentifier
  swapCommit?: string
  swapRecord?: string
  validate?: boolean
}

export type ListRecordsOptions = CallOptions & {
  repo?: AtIdentifier
  limit?: number
  cursor?: string
  reverse?: boolean
}

export type RecordKeyOptions<
  T extends RecordSchema,
  AlsoOptionalWhenRecordKeyIs extends RecordKey = never,
> = T['key'] extends `literal:${string}` | AlsoOptionalWhenRecordKeyIs
  ? { rkey?: InferRecordKey<T> }
  : { rkey: InferRecordKey<T> }

export type CreateOptions<T extends RecordSchema> = CreateRecordOptions &
  RecordKeyOptions<T, 'tid'>
export type CreateOutput = XrpcOutputBody<typeof createRecord.main>

export type DeleteOptions<T extends RecordSchema> = DeleteRecordOptions &
  RecordKeyOptions<T>
export type DeleteOutput = XrpcOutputBody<typeof deleteRecord.main>

export type GetOptions<T extends RecordSchema> = GetRecordOptions &
  RecordKeyOptions<T>
export type GetOutput<T extends RecordSchema> = Omit<
  XrpcOutputBody<typeof getRecord.main>,
  'value'
> & { value: Infer<T> }

export type PutOptions<T extends RecordSchema> = PutRecordOptions &
  RecordKeyOptions<T>
export type PutOutput = XrpcOutputBody<typeof putRecord.main>

export type ListOptions = ListRecordsOptions
export type ListOutput<T extends RecordSchema> = XrpcOutputBody<
  typeof listRecords.main
> & {
  records: ListRecord<T>[]
  // @NOTE Because the schema uses "type": "unknown" instead of an open union,
  // we have to use LexMap instead of TypedObject here.
  invalid: LexMap[]
}
export type ListRecord<T extends RecordSchema> = listRecords.DefRecord & {
  value: Infer<T>
}

export class Client implements Agent {
  static appLabelers: readonly Did[] = []

  /**
   * Configures the Client (or its sub classes) globally.
   */
  static configure(opts: { appLabelers?: Iterable<Did> }) {
    if (opts.appLabelers) this.appLabelers = [...opts.appLabelers]
  }

  public readonly agent: Agent
  public readonly headers: Headers
  public readonly service?: Service
  public readonly labelers: Set<Did>

  constructor(agent: Agent | AgentOptions, options: ClientOptions = {}) {
    this.agent =
      typeof agent === 'object' && 'fetchHandler' in agent
        ? agent
        : buildAgent(agent)
    this.service = options.service
    this.labelers = new Set(options.labelers)
    this.headers = new Headers(options.headers)
  }

  get did(): Did | undefined {
    return this.agent.did
  }

  get assertDid(): Did {
    this.assertAuthenticated()
    return this.did
  }

  public assertAuthenticated(): asserts this is { did: Did } {
    if (!this.did) throw new Error('Not authenticated')
  }

  public setLabelers(labelers: Iterable<Did> = []) {
    this.clearLabelers()
    this.addLabelers(labelers)
  }

  public addLabelers(labelers: Iterable<Did>) {
    for (const labeler of labelers) this.labelers.add(labeler)
  }

  public clearLabelers() {
    this.labelers.clear()
  }

  public fetchHandler(path: string, init: RequestInit): Promise<Response> {
    const headers = buildHeaders({
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
  ): Promise<XrpcOutput<M>>
  async xrpc<const M extends Query | Procedure>(
    ns: Namespace<M>,
    options: XrpcOptions<M>,
  ): Promise<XrpcOutput<M>>
  async xrpc<const M extends Query | Procedure>(
    ns: Namespace<M>,
    options: XrpcOptions<M> = {} as XrpcOptions<M>,
  ): Promise<XrpcOutput<M>> {
    options.signal?.throwIfAborted()
    const method = getMain(ns)
    const url = xrpcRequestUrl(method, options)
    const request = xrpcRequestInit(method, options)
    const response = await this.fetchHandler(url, request)
    return await xrpcResponse(response, method, options)
  }

  async xrpcSafe<const M extends Query | Procedure>(
    ns: NonNullable<unknown> extends XrpcOptions<M>
      ? Namespace<M>
      : Restricted<'This XRPC method requires an "options" argument'>,
  ): Promise<
    | XrpcOutput<M>
    | (M extends { errors: readonly (infer N extends string)[] }
        ? XrpcResponseError<N>
        : never)
  >
  async xrpcSafe<const M extends Query | Procedure>(
    ns: Namespace<M>,
    options: XrpcOptions<M>,
  ): Promise<
    | XrpcOutput<M>
    | (M extends { errors: readonly (infer N extends string)[] }
        ? XrpcResponseError<N>
        : never)
  >
  async xrpcSafe<const M extends Query | Procedure>(
    ns: Namespace<M>,
    options: XrpcOptions<M> = {} as XrpcOptions<M>,
  ): Promise<unknown> {
    return this.xrpc(ns, options).catch(XrpcResponseError.catcherFor(ns))
  }

  /**
   * @param rkey Leave `undefined` to have the server generate a TID.
   */
  public async createRecord(
    record: { $type: Nsid } & LexMap,
    rkey?: string,
    options?: CreateRecordOptions,
  ) {
    return this.xrpc(createRecord.main, {
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
      XrpcResponseError.catcherFor(createRecord),
    )
  }

  async deleteRecord(
    collection: Nsid,
    rkey: string,
    options?: DeleteRecordOptions,
  ) {
    return this.xrpc(deleteRecord.main, {
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
      XrpcResponseError.catcherFor(deleteRecord),
    )
  }

  public async getRecord(
    collection: Nsid,
    rkey: string,
    options?: GetRecordOptions,
  ) {
    return this.xrpc(getRecord.main, {
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
      XrpcResponseError.catcherFor(getRecord),
    )
  }

  async putRecord(
    record: { $type: Nsid } & LexMap,
    rkey: string,
    options?: PutRecordOptions,
  ) {
    return this.xrpc(putRecord.main, {
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
      XrpcResponseError.catcherFor(putRecord),
    )
  }

  async listRecords(nsid: Nsid, options?: ListRecordsOptions) {
    return this.xrpc(listRecords.main, {
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
    params: InferQueryParameters<T>,
    options?: CallOptions,
  ): Promise<InferQueryOutputBody<T>>
  public async call(
    ns: Namespace<Action> | Namespace<Procedure> | Namespace<Query>,
    arg?: LexValue,
    options: CallOptions = {},
  ): Promise<unknown> {
    const schema = getMain(ns)

    if (typeof schema === 'function') {
      return schema(this, arg, options)
    }

    if (schema instanceof Procedure) {
      const body = arg as LexValue | undefined
      const result = await this.xrpc(schema, { ...options, body })
      return result.body
    } else if (schema instanceof Query) {
      const params = arg as Params | undefined
      const result = await this.xrpc(schema, { ...options, params })
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
      const parsed = schema.validate(record.value) as ValidationResult<Infer<T>>
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

type XrpcRequestUrlOptions<M extends Query | Procedure | Subscription> =
  CallOptions &
    (undefined extends InferParamsSchema<M['parameters']>
      ? { params?: InferParamsSchema<M['parameters']> }
      : { params: InferParamsSchema<M['parameters']> })

function xrpcRequestUrl<M extends Procedure | Query | Subscription>(
  method: M,
  options: XrpcRequestUrlOptions<M>,
) {
  const path = `/xrpc/${method.nsid}`
  const queryString = xrpcRequestParams(method.parameters, options.params)
  const url = queryString ? `${path}?${queryString}` : path
  return url
}

function xrpcRequestParams(
  schema: ParamsSchema | undefined,
  params: Params | undefined,
): string {
  // @NOTE We don't validate params against schema here, as it should be covered
  // by type-checking at compile time, and will be validated server-side.
  if (!params) return ''
  const urlSearchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        urlSearchParams.append(key, String(v))
      }
    } else if (value !== undefined) {
      urlSearchParams.append(key, String(value))
    }
  }
  return urlSearchParams.toString()
}

type XrpcRequestBodyOptions<T extends Query | Procedure> = CallOptions & {
  // validateRequest?: boolean // TODO ?
} & (T extends Procedure
    ? never extends InferPayloadBody<T['input']>
      ? { body?: InferPayloadBody<T['input']> }
      : { body: InferPayloadBody<T['input']> }
    : { body?: never })

function xrpcRequestInit<T extends Procedure | Query>(
  schema: T,
  options: XrpcRequestBodyOptions<T>,
): RequestInit & { duplex?: 'half' } {
  const headers = buildHeaders(options)

  // Requests with body
  if ('input' in schema && schema.input?.encoding) {
    headers.set('content-type', schema.input.encoding)
    return {
      duplex: 'half',
      redirect: 'follow',
      referrerPolicy: 'strict-origin-when-cross-origin', // (default)
      mode: 'cors', // (default)
      signal: options.signal,
      method: 'POST',
      headers,
      body: xrpcRequestBody(schema.input, options.body),
    }
  }

  // Requests without body
  return {
    duplex: 'half',
    redirect: 'follow',
    referrerPolicy: 'strict-origin-when-cross-origin', // (default)
    mode: 'cors', // (default)
    signal: options.signal,
    method: schema instanceof Query ? 'GET' : 'POST',
    headers,
  }
}

function xrpcRequestBody(
  payload: Payload | undefined,
  body: LexValue | undefined,
): BodyInit | null {
  if (payload?.encoding === undefined) {
    return null
  }

  if (payload.encoding === 'application/json') {
    if (body !== undefined) return lexStringify(body)
  } else if (payload.encoding.startsWith('text/')) {
    if (typeof body === 'string') return body
  } else {
    if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer) return body
  }

  throw new TypeError(
    `Invalid ${typeof body} body for ${payload.encoding} encoding`,
  )
}

async function xrpcResponse<M extends Query | Procedure>(
  response: Response,
  { output }: M,
  options: CallOptions,
): Promise<XrpcOutput<M>> {
  // @NOTE The body MUST either be read or canceled to avoid resource leaks.
  // Since nothing should cause an exception before "readXrpcResponseBody" is
  // called, we can safely not use a try/finally here.

  const encoding = response.headers.get('content-type')?.split(';')[0].trim()

  const body = await readXrpcResponseBody(response, encoding).catch((cause) => {
    throw new XrpcServiceError(
      KnownError.InvalidResponse,
      response.status,
      response.headers,
      undefined,
      'Failed to read XRPC response',
      { cause },
    )
  })

  // @NOTE redirect is set to 'follow', so we shouldn't get 3xx responses here
  if (response.status < 200 || response.status >= 300) {
    throw XrpcResponseError.fromResponse(
      response.status,
      response.headers,
      encoding,
      body,
    )
  }

  // Check response encoding
  if (output.encoding !== encoding) {
    throw new XrpcServiceError(
      KnownError.InvalidResponse,
      response.status,
      response.headers,
      body,
      `Expected response with content-type ${output.encoding}, got ${encoding}`,
    )
  }

  if (output.encoding == null) {
    // No output expected
    if (body !== undefined) {
      throw new XrpcServiceError(
        KnownError.InvalidResponse,
        response.status,
        response.headers,
        body,
        `Expected empty response body`,
      )
    }

    return {
      success: true,
      status: response.status,
      headers: response.headers,
      encoding: output.encoding,
      body: undefined as InferPayloadBody<M['output']>,
    }
  } else {
    // Output expected
    return {
      success: true,
      status: response.status,
      headers: response.headers,
      encoding: output.encoding,
      body:
        output.schema == null || options.validateResponse === false
          ? body
          : output.schema.parse(body),
    }
  }
}

function buildHeaders(options: {
  headers?: HeadersInit
  service?: Service
  labelers?: Iterable<Did>
}): Headers {
  const headers = new Headers(options.headers)

  if (options.service && !headers.has('atproto-proxy')) {
    headers.set('atproto-proxy', options.service)
  }

  if (options.labelers) {
    headers.set(
      'atproto-accept-labelers',
      [...options.labelers, headers.get('atproto-accept-labelers')?.trim()]
        .filter(Boolean)
        .join(', '),
    )
  }

  return headers
}

async function readXrpcResponseBody(
  response: Response,
  encoding: string,
): Promise<LexValue>
async function readXrpcResponseBody(
  response: Response,
  encoding: string | undefined,
): Promise<LexValue | undefined>
async function readXrpcResponseBody(
  response: Response,
  encoding: string | undefined,
): Promise<LexValue | undefined> {
  // When encoding is undefined or empty, we expect no body
  if (encoding == null) {
    if (response.body == null) return undefined

    // Let's make sure the body is empty (while avoiding reading it all).
    if (!('getReader' in response.body)) {
      // Some environments may not support body.getReader(), fall back to
      // reading the whole body.
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) return undefined
    } else {
      const reader = response.body.getReader()
      const next = await reader.read()
      if (next.done) return undefined
      await reader.cancel() // Drain the rest of the (non-empty) body stream
    }

    throw new SyntaxError('Content-type is undefined but body is not empty')
  }

  if (encoding === 'application/json') {
    // @NOTE Using `lexParse(text)` (instead of `jsonToLex(json)`) here as using
    // a reviver function during JSON.parse should be faster than parsing to
    // JSON then converting to Lex (?)

    // @TODO verify statement above
    return lexParse(await response.text())
  }

  if (encoding.startsWith('text/')) {
    return response.text()
  }

  return new Uint8Array(await response.arrayBuffer())
}

type Namespace<T> = T | { main: T }

function getMain<T extends object>(ns: Namespace<T>): T {
  return 'main' in ns ? ns.main : ns
}
