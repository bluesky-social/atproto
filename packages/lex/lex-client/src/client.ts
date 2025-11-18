import { LexMap, LexValue } from '@atproto/lex-data'
import { lexParse, lexStringify } from '@atproto/lex-json'
import {
  AtIdentifier,
  AtUri,
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
  Parameters,
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
import { LexRpcInvalidError, LexRpcResponseError } from './error.js'
import * as createRecord from './lexicons/com/atproto/repo/createRecord.defs.js'
import * as deleteRecord from './lexicons/com/atproto/repo/deleteRecord.defs.js'
import * as getRecord from './lexicons/com/atproto/repo/getRecord.defs.js'
import * as listRecords from './lexicons/com/atproto/repo/listRecords.defs.js'
import * as putRecord from './lexicons/com/atproto/repo/putRecord.defs.js'
import {
  KnownError,
  LexRpcResponse,
  lexRpcErrorBodySchema,
} from './response.js'

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
}

export type LexRpcOptions<M extends Procedure | Query = Procedure | Query> =
  LexRpcRequestOptions<M> & LexRpcResponseOptions

export type LexRpcRequestOptions<M extends Procedure | Query> = CallOptions &
  LexRpcRequestUrlOptions<M> &
  LexRpcRequestBodyOptions<M>

export type LexRpcRequestUrlOptions<
  M extends Query | Procedure | Subscription,
> =
  undefined extends InferParamsSchema<M['parameters']>
    ? { params?: InferParamsSchema<M['parameters']> }
    : { params: InferParamsSchema<M['parameters']> }

export type LexRpcRequestBodyOptions<T extends Query | Procedure> =
  T extends Procedure
    ? never extends InferPayloadBody<T['input']>
      ? { body?: InferPayloadBody<T['input']> }
      : { body: InferPayloadBody<T['input']> }
    : { body?: never }

export type LexRpcResponseOptions = { skipVerification?: boolean }

export type Action<I = any, O = any> = (
  client: Client,
  input: I,
  options: CallOptions,
) => O | Promise<O>
export type InferActionInput<A extends Action> =
  A extends Action<infer I, any> ? I : never
export type InferActionOutput<A extends Action> =
  A extends Action<any, infer O> ? O : never

export type CreateRecordOutput = LexRpcResponse<typeof createRecord.main>
export type CreateRecordOptions = CallOptions &
  LexRpcResponseOptions & {
    repo?: AtIdentifier
    swapCommit?: string
    validate?: boolean
  }

export type DeleteRecordOutput = LexRpcResponse<typeof deleteRecord.main>
export type DeleteRecordOptions = CallOptions &
  LexRpcResponseOptions & {
    repo?: AtIdentifier
    swapCommit?: string
    swapRecord?: string
  }

export type PutRecordOutput = LexRpcResponse<typeof putRecord.main>
export type PutRecordOptions = CallOptions &
  LexRpcResponseOptions & {
    repo?: AtIdentifier
    swapCommit?: string
    swapRecord?: string
    validate?: boolean
  }

export type GetRecordOutput = LexRpcResponse<typeof getRecord.main>
export type GetRecordOptions = CallOptions &
  LexRpcResponseOptions & {
    repo?: AtIdentifier
  }

export type ListRecordsOutput = LexRpcResponse<typeof listRecords.main>
export type ListRecordsOptions = CallOptions &
  LexRpcResponseOptions & {
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

export type CreateOutput = Extract<
  CreateRecordOutput,
  { success: true }
>['body']
export type CreateOptions<T extends RecordSchema> = CreateRecordOptions &
  RecordKeyOptions<T, 'tid'>

export type DeleteOutput = Extract<
  DeleteRecordOutput,
  { success: true }
>['body']
export type DeleteOptions<T extends RecordSchema> = DeleteRecordOptions &
  RecordKeyOptions<T>

export type GetOutput<T extends RecordSchema> = Infer<T>
export type GetOptions<T extends RecordSchema> = GetRecordOptions &
  RecordKeyOptions<T>

export type PutOutput = Extract<PutRecordOutput, { success: true }>['body']
export type PutOptions<T extends RecordSchema> = PutRecordOptions &
  RecordKeyOptions<T>

export type ListOptions = ListRecordsOptions
export type ListOutput<T extends RecordSchema> = {
  cursor: string | undefined
  values: ListValue<T>[]
}
export type ListValue<T extends RecordSchema> = {
  cid: string
  uri: AtUri
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

  //#region Session

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

  //#endregion

  //#region Core com.atproto labelers

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

  //#endregion

  //#region Agent fetch handler

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

  //#endregion

  //#region Lexicon RPC request

  async rpc<const M extends Query | Procedure>(
    ns: NonNullable<unknown> extends LexRpcOptions<M>
      ? Namespace<M>
      : Restricted<'This XRPC method requires an "options" argument'>,
  ): Promise<LexRpcResponse<M>>
  async rpc<const T extends Query | Procedure>(
    ns: Namespace<T>,
    options: LexRpcOptions<T>,
  ): Promise<LexRpcResponse<T>>
  async rpc<const T extends Query | Procedure>(
    ns: Namespace<T>,
    options: LexRpcOptions<T> = {} as LexRpcOptions<T>,
  ): Promise<LexRpcResponse<T>> {
    options.signal?.throwIfAborted()
    const method = getMain(ns)
    const url = buildLexRpcRequestUrl(method, options)
    const request = buildLexRpcRequestInit(method, options)
    const response = await this.fetchHandler(url, request).catch(
      handleFetchError,
    )
    return await handleLexRpcResponse(response, method, options)
  }

  //#endregion

  //#region Core com.atproto XRPC methods

  /**
   * @param rkey Leave `undefined` to have the server generate a TID.
   */
  public async createRecord(
    record: { $type: Nsid } & LexMap,
    rkey: string | undefined,
    options?: CreateRecordOptions,
  ): Promise<CreateRecordOutput> {
    return this.rpc(createRecord.main, {
      signal: options?.signal,
      headers: options?.headers,
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
    collection: Nsid,
    rkey: string,
    options?: DeleteRecordOptions,
  ) {
    return this.rpc(deleteRecord.main, {
      signal: options?.signal,
      headers: options?.headers,
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
    collection: Nsid,
    rkey: string,
    options?: GetRecordOptions,
  ): Promise<GetRecordOutput> {
    return this.rpc(getRecord.main, {
      signal: options?.signal,
      headers: options?.headers,
      params: {
        repo: options?.repo ?? this.assertDid,
        collection,
        rkey,
      },
    })
  }

  async putRecord(
    record: { $type: Nsid } & LexMap,
    rkey: string,
    options?: PutRecordOptions,
  ): Promise<PutRecordOutput> {
    return this.rpc(putRecord.main, {
      signal: options?.signal,
      headers: options?.headers,
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

  async listRecords(
    nsid: Nsid,
    options?: ListRecordsOptions,
  ): Promise<ListRecordsOutput> {
    return this.rpc(listRecords.main, {
      signal: options?.signal,
      headers: options?.headers,
      params: {
        repo: options?.repo ?? this.assertDid,
        collection: nsid,
        cursor: options?.cursor,
        limit: options?.limit,
        reverse: options?.reverse,
      },
    })
  }

  //#endregion

  //#region Convenience Methods

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
    arg: undefined | LexValue = undefined,
    options: CallOptions = {},
  ): Promise<unknown> {
    const schema = getMain(ns)

    if (typeof schema === 'function') {
      return schema(this, arg, options)
    }

    if (schema instanceof Procedure) {
      const body = arg as LexValue | undefined
      const result = await this.rpc(schema, { ...options, body })
      return result.body
    } else if (schema instanceof Query) {
      const params = arg as Parameters | undefined
      const result = await this.rpc(schema, { ...options, params })
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
    LexRpcResponseError.assertResponseSuccess(response)
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
    LexRpcResponseError.assertResponseSuccess(response)
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
    LexRpcResponseError.assertResponseSuccess(response)
    return schema.parse(response.body.value) as Infer<T>
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
    LexRpcResponseError.assertResponseSuccess(response)
    return response.body
  }

  async list<const T extends RecordSchema>(
    ns: Namespace<T>,
    options?: ListOptions,
  ): Promise<ListOutput<T>> {
    const schema = getMain(ns)
    const response = await this.listRecords(schema.$type, options)
    LexRpcResponseError.assertResponseSuccess(response)

    const values: ListValue<T>[] = []

    // Keep only valid records
    for (const record of response.body.records) {
      const parsed = schema.validate(record.value) as ValidationResult<Infer<T>>
      if (parsed.success) {
        values.push({
          cid: record.cid,
          uri: record.uri,
          value: parsed.value,
        })
      }
    }

    return { cursor: response.body.cursor, values }
  }

  //#endregion
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

function buildLexRpcRequestUrl<M extends Procedure | Query | Subscription>(
  method: M,
  options: LexRpcRequestUrlOptions<M>,
) {
  const path = `/rpc/${method.nsid}`
  const queryString = buildLexRpcRequestParams(
    method.parameters,
    options.params,
  )
  const url = queryString ? `${path}?${queryString}` : path
  return url
}

function buildLexRpcRequestParams(
  schema: ParamsSchema | undefined,
  params: Parameters | undefined,
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

function buildLexRpcRequestInit<T extends Procedure | Query>(
  schema: T,
  options: LexRpcRequestOptions<T>,
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
      body: buildLexRpcRequestBody(schema.input, options.body),
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

function buildLexRpcRequestBody(
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

async function handleFetchError(err: unknown): Promise<never> {
  // @TODO
  throw err
}

async function handleLexRpcResponse<T extends Query | Procedure>(
  response: Response,
  { output }: T,
  options: LexRpcOptions<T>,
): Promise<LexRpcResponse<T>> {
  try {
    const encoding = getContentMime(response.headers)

    const body = await readLexRpcResponseBody(response, encoding).catch(
      (cause) => {
        throw new LexRpcInvalidError(
          response.status,
          response.headers,
          body,
          'Failed to read XRPC response body',
          undefined,
          { cause },
        )
      },
    )

    if (response.status >= 400) {
      // All unsuccessful responses should follow a standard error response
      // schema. The Content-Type should be application/json, and the payload
      // should be a JSON object with the following fields:
      // - error (string, required): type name of the error (generic ASCII
      //   constant, no whitespace)
      // - message (string, optional): description of the error, appropriate for
      //   display to humans
      if (
        encoding !== 'application/json' ||
        body == null ||
        !lexRpcErrorBodySchema.check(body)
      ) {
        throw new LexRpcInvalidError(
          response.status,
          response.headers,
          body,
          'Invalid response body for error response',
          response.status >= 500
            ? KnownError.InternalServerError
            : KnownError.InvalidRequest,
        )
      }

      if (!output.errors?.includes(body.error)) {
        throw new LexRpcResponseError(response.status, response.headers, body)
      }

      return {
        success: false,
        status: response.status,
        headers: response.headers,
        encoding,
        body,
      } as LexRpcResponse<T>
    }

    // @NOTE redirect is set to 'follow', so we shouldn't get 3xx responses here
    if (response.status < 200 || response.status >= 300) {
      throw new LexRpcInvalidError(
        response.status,
        response.headers,
        body,
        'Invalid response status',
      )
    }

    // Check response encoding
    if (output.encoding !== encoding) {
      throw new LexRpcInvalidError(
        response.status,
        response.headers,
        body,
        `Expected response with content-type ${output.encoding}, got ${encoding}`,
      )
    }

    // Validate response body
    if (output.encoding && output.schema && !options.skipVerification) {
      return {
        success: true,
        status: response.status,
        headers: response.headers,
        encoding: output.encoding as InferPayloadEncoding<T['output']>,
        body: output.schema.parse(body),
      }
    }

    if (output.encoding === undefined && body !== undefined) {
      throw new LexRpcInvalidError(
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
      encoding,
      body,
    } as LexRpcResponse<T>
  } finally {
    await cancelBody(response)
  }
}

async function cancelBody(body: Body): Promise<void> {
  if (
    body.body &&
    !body.bodyUsed &&
    !body.body.locked &&
    // Support for alternative fetch implementations
    typeof body.body.cancel === 'function'
  ) {
    await body.body.cancel()
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

async function readLexRpcResponseBody(
  response: Response,
  encoding: string,
): Promise<LexValue>
async function readLexRpcResponseBody(
  response: Response,
  encoding: string | undefined,
): Promise<LexValue | undefined>
async function readLexRpcResponseBody(
  response: Response,
  encoding: string | undefined,
): Promise<LexValue | undefined> {
  // When encoding is undefined or empty, we expect no body
  if (!encoding) {
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

function getContentMime(headers: Headers): string | undefined {
  const contentType = headers.get('content-type')
  if (!contentType) return undefined
  return contentType.split(';')[0].trim()
}

type Namespace<T> = T | { main: T }

function getMain<T extends object>(ns: Namespace<T>): T {
  return 'main' in ns ? ns.main : ns
}
