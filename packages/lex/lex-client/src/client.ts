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
  Lex,
  LexMap,
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
  lexParse,
  lexStringify,
} from '@atproto/lex-schema'
import { Agent, AgentOptions, buildAgent } from './agent.js'
import * as createRecord from './lexicons/com/atproto/repo/createRecord.defs.js'
import * as deleteRecord from './lexicons/com/atproto/repo/deleteRecord.defs.js'
import * as getRecord from './lexicons/com/atproto/repo/getRecord.defs.js'
import * as listRecords from './lexicons/com/atproto/repo/listRecords.defs.js'
import * as putRecord from './lexicons/com/atproto/repo/putRecord.defs.js'

export type DidServiceId = 'atproto_labeler' | UnknownString
export type DidService = `${Did}#${DidServiceId}`

export type ClientOptions = {
  headers?: HeadersInit
  service?: DidService
  labelers?: Iterable<Did>
}

export type CallOptions = {
  headers?: HeadersInit
  signal?: AbortSignal
}

export type XrpcOptions<M extends Procedure | Query = Procedure | Query> =
  CallOptions &
    XrpcRequestParamsOptions<M> &
    XrpcRequestInitOptions<M> &
    XrpcResponseOptions

export type XrpcRequestParamsOptions<
  M extends Query | Procedure | Subscription,
> =
  undefined extends InferParamsSchema<M['parameters']>
    ? { params?: InferParamsSchema<M['parameters']> }
    : { params: InferParamsSchema<M['parameters']> }

export type XrpcRequestInitOptions<T extends Query | Procedure> =
  T extends Procedure
    ? never extends InferPayloadBody<T['input']>
      ? { body?: InferPayloadBody<T['input']> }
      : { body: InferPayloadBody<T['input']> }
    : { body?: never }

export type XrpcResponseOptions = { skipVerification?: boolean }

export type XrpcResponse<S extends Procedure | Query = Procedure | Query> = {
  status: number
  headers: Headers
  encoding: InferPayloadEncoding<S['output']>
  body: InferPayloadBody<S['output']>
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

export type CreateRecordOutput = XrpcResponse<typeof createRecord.main>
export type CreateRecordOptions = CallOptions &
  XrpcResponseOptions & {
    repo?: AtIdentifier
    swapCommit?: string
    validate?: boolean
  }

export type DeleteRecordOutput = XrpcResponse<typeof deleteRecord.main>
export type DeleteRecordOptions = CallOptions &
  XrpcResponseOptions & {
    repo?: AtIdentifier
    swapCommit?: string
    swapRecord?: string
  }

export type PutRecordOutput = XrpcResponse<typeof putRecord.main>
export type PutRecordOptions = CallOptions &
  XrpcResponseOptions & {
    repo?: AtIdentifier
    swapCommit?: string
    swapRecord?: string
    validate?: boolean
  }

export type GetRecordOutput = XrpcResponse<typeof getRecord.main>
export type GetRecordOptions = CallOptions &
  XrpcResponseOptions & {
    repo?: AtIdentifier
  }

export type ListRecordsOutput = XrpcResponse<typeof listRecords.main>
export type ListRecordsOptions = CallOptions &
  XrpcResponseOptions & {
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

export type CreateOutput = CreateRecordOutput
export type CreateOptions<T extends RecordSchema> = CreateRecordOptions &
  RecordKeyOptions<T, 'tid'>

export type DeleteOutput = DeleteRecordOutput
export type DeleteOptions<T extends RecordSchema> = DeleteRecordOptions &
  RecordKeyOptions<T>

export type GetOutput<T extends RecordSchema> = Infer<T>
export type GetOptions<T extends RecordSchema> = GetRecordOptions &
  RecordKeyOptions<T>

export type PutOutput = PutRecordOutput['body']
export type PutOptions<T extends RecordSchema> = PutRecordOptions &
  RecordKeyOptions<T>

export type ListOptions = ListRecordsOptions
export type ListOutput<T extends RecordSchema> = {
  cursor: string | undefined
  values: Array<{
    cid: string
    uri: AtUri
    value: Infer<T>
  }>
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
  public readonly service?: DidService
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
    const headers = new Headers(init.headers)

    // Incoming headers take precedence
    if (this.service && !headers.has('atproto-proxy')) {
      headers.set('atproto-proxy', this.service)
    }

    // Incoming headers take precedence
    for (const [key, value] of this.headers) {
      if (!headers.has(key)) headers.set(key, value)
    }

    // Merge incoming labelers with client-wide and app-wide labelers
    headers.set(
      'atproto-accept-labelers',
      [
        ...(this.constructor as typeof Client).appLabelers.map(
          (l) => `${l};redact`,
        ),
        ...this.labelers,
        headers.get('atproto-accept-labelers')?.trim(),
      ]
        .filter(Boolean)
        .join(', '),
    )

    return this.agent.fetchHandler(path, { ...init, headers })
  }

  //#endregion

  //#region XRPC request

  async xrpc<const M extends Query | Procedure>(
    method: NonNullable<unknown> extends XrpcOptions<M>
      ? M
      : Restricted<'This XRPC method requires an "options" argument'>,
  ): Promise<XrpcResponse<M>>
  async xrpc<const T extends Query | Procedure>(
    method: T,
    options: XrpcOptions<T>,
  ): Promise<XrpcResponse<T>>
  async xrpc<const T extends Query | Procedure>(
    method: T,
    options: XrpcOptions<T> = {} as XrpcOptions<T>,
  ): Promise<XrpcResponse<T>> {
    options.signal?.throwIfAborted()
    const url = buildXrpcRequestUrl(method, options)
    const request = buildXrpcRequestInit(method, options)
    const response = await this.fetchHandler(url, request).catch(
      handleFetchError,
    )
    return await handleXrpcResponse(response, method, options)
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
    return this.xrpc(createRecord.main, {
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
    return this.xrpc(deleteRecord.main, {
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
    return this.xrpc(getRecord.main, {
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
    return this.xrpc(putRecord.main, {
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
    return this.xrpc(listRecords.main, {
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
    ns: T,
    input: InferActionInput<T>,
    options?: CallOptions,
  ): Promise<InferActionOutput<T>>
  public async call<const T extends Query>(
    ns: NonNullable<unknown> extends InferQueryParameters<T>
      ? T | { main: T }
      : Restricted<'This query type requires a "params" argument'>,
  ): Promise<InferQueryOutputBody<T>>
  public async call<const T extends Query>(
    ns: T | { main: T },
    params: InferQueryParameters<T>,
    options?: CallOptions,
  ): Promise<InferQueryOutputBody<T>>
  public async call<const T extends Procedure>(
    ns: T | { main: T },
    body: InferProcedureInputBody<T>,
    options?: CallOptions,
  ): Promise<InferProcedureOutputBody<T>>
  public async call(
    ns: Action | Query | Procedure | { main: Query | Procedure },
    arg: undefined | Lex = undefined,
    options: CallOptions = {},
  ): Promise<unknown> {
    if (typeof ns === 'function') {
      return ns(this, arg, options)
    }

    const schema = 'lexiconType' in ns ? ns : ns.main

    if (schema.lexiconType === 'query') {
      const params = arg as Parameters | undefined
      const result = await this.xrpc(schema, { ...options, params })
      return result.body
    } else if (schema.lexiconType === 'procedure') {
      const body = arg as Lex | undefined
      const result = await this.xrpc(schema, { ...options, body })
      return result.body
    } else {
      throw new TypeError('Invalid lexicon')
    }
  }

  public async create<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends CreateOptions<T>
      ? T | { main: T }
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<Infer<T>, '$type'>,
  ): Promise<CreateOutput>
  public async create<const T extends RecordSchema>(
    ns: T | { main: T },
    input: Omit<Infer<T>, '$type'>,
    options: CreateOptions<T>,
  ): Promise<CreateOutput>
  public async create<const T extends RecordSchema>(
    ns: T | { main: T },
    input: Omit<Infer<T>, '$type'>,
    options: CreateOptions<T> = {} as CreateOptions<T>,
  ): Promise<CreateOutput> {
    const schema: RecordSchema = 'lexiconType' in ns ? ns : ns.main
    const record = schema.build(input)
    const rkey = options.rkey ?? getDefaultRecordKey(schema)
    if (rkey !== undefined) schema.keySchema.assert(rkey)
    return this.createRecord(record, rkey, options)
  }

  public async delete<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends DeleteOptions<T>
      ? T | { main: T }
      : Restricted<'This record type requires an "options" argument'>,
  ): Promise<DeleteOutput>
  public async delete<const T extends RecordSchema>(
    ns: T | { main: T },
    options?: DeleteOptions<T>,
  ): Promise<DeleteOutput>
  public async delete<const T extends RecordSchema>(
    ns: T | { main: T },
    options: DeleteOptions<T> = {} as DeleteOptions<T>,
  ): Promise<DeleteOutput> {
    const schema: RecordSchema = 'lexiconType' in ns ? ns : ns.main
    const rkey = schema.keySchema.parse(
      options.rkey ?? getLiteralRecordKey(schema),
    )
    return this.deleteRecord(schema.$type, rkey, options)
  }

  public async get<const T extends RecordSchema>(
    ns: T['key'] extends `literal:${string}`
      ? T | { main: T }
      : Restricted<'This record type requires an "options" argument'>,
  ): Promise<GetOutput<T>>
  public async get<const T extends RecordSchema>(
    ns: T | { main: T },
    options?: GetOptions<T>,
  ): Promise<GetOutput<T>>
  public async get<const T extends RecordSchema>(
    ns: T | { main: T },
    options: GetOptions<T> = {} as GetOptions<T>,
  ): Promise<GetOutput<T>> {
    const schema: RecordSchema = 'lexiconType' in ns ? ns : ns.main
    const rkey = schema.keySchema.parse(
      options.rkey ?? getLiteralRecordKey(schema),
    )
    const response = await this.getRecord(schema.$type, rkey, options)
    return schema.parse(response.body.value) as Infer<T>
  }

  public async put<const T extends RecordSchema>(
    ns: NonNullable<unknown> extends PutOptions<T>
      ? T | { main: T }
      : Restricted<'This record type requires an "options" argument'>,
    input: Omit<Infer<T>, '$type'>,
  ): Promise<PutOutput>
  public async put<const T extends RecordSchema>(
    ns: T | { main: T },
    input: Omit<Infer<T>, '$type'>,
    options: PutOptions<T>,
  ): Promise<PutOutput>
  public async put<const T extends RecordSchema>(
    ns: T | { main: T },
    input: Omit<Infer<T>, '$type'>,
    options: PutOptions<T> = {} as PutOptions<T>,
  ): Promise<PutOutput> {
    const schema: RecordSchema = 'lexiconType' in ns ? ns : ns.main
    const record = schema.build(input)
    const rkey = options.rkey ?? getLiteralRecordKey(schema)
    const response = await this.putRecord(record, rkey, options)
    return response.body
  }

  async list<const T extends RecordSchema>(
    ns: T | { main: T },
    options?: ListOptions,
  ): Promise<ListOutput<T>> {
    const schema: RecordSchema = 'lexiconType' in ns ? ns : ns.main
    const { body } = await this.listRecords(schema.$type, options)
    const result: ListOutput<T> = { cursor: body.cursor, values: [] }

    // Keep only valid records
    for (const record of body.records) {
      const parsed = schema.validate(record.value) as ValidationResult<Infer<T>>
      if (parsed.success) {
        result.values.push({
          cid: record.cid,
          uri: record.uri,
          value: parsed.value,
        })
      }
    }

    return result
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

function buildXrpcRequestUrl<M extends Procedure | Query | Subscription>(
  method: M,
  options: XrpcRequestParamsOptions<M>,
) {
  const path = `/xrpc/${method.nsid}`
  const queryString = buildXrpcRequestParams(method.parameters, options.params)
  const url = queryString ? `${path}?${queryString}` : path
  return url
}

function buildXrpcRequestParams(
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

function buildXrpcRequestInit<T extends Procedure | Query>(
  schema: T,
  options: CallOptions & XrpcRequestInitOptions<T>,
): RequestInit & { duplex?: 'half' } {
  // Requests with body
  if ('input' in schema && schema.input?.encoding) {
    const headers = new Headers(options.headers)
    headers.set('content-type', schema.input.encoding)
    return {
      duplex: 'half',
      redirect: 'follow',
      referrerPolicy: 'strict-origin-when-cross-origin', // (default)
      mode: 'cors', // (default)
      signal: options.signal,
      method: 'POST',
      headers,
      body: buildXrpcRequestBody(schema.input, options.body),
    }
  }

  // Requests without body
  return {
    duplex: 'half',
    redirect: 'follow',
    referrerPolicy: 'strict-origin-when-cross-origin', // (default)
    mode: 'cors', // (default)
    signal: options.signal,
    method: schema.lexiconType === 'query' ? 'GET' : 'POST',
    headers: options.headers,
  }
}

function buildXrpcRequestBody(
  payload: Payload | undefined,
  body: Lex | undefined,
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
  throw new Error('Fetch error', { cause: err })
}

async function handleXrpcResponse<T extends Query | Procedure>(
  response: Response,
  { output }: T,
  options: XrpcOptions<T>,
): Promise<XrpcResponse<T>> {
  try {
    const encoding = getContentMime(response.headers)

    // Check response status
    if (response.status < 200 || response.status >= 300) {
      // @TODO xrpc error
      throw new Error(`Request failed with status ${response.status}`, {
        cause: {
          encoding,
          body: await readXrpcResponseBody(response, encoding).catch(
            (err) => `<Response error: ${String(err)}>`,
          ),
        },
      })
    }

    // Check response encoding
    if (output.encoding !== encoding) {
      // @TODO 400 error
      throw new Error(
        `Expected response with content-type ${output.encoding}, got ${encoding}`,
        {
          cause: {
            encoding,
            body: await readXrpcResponseBody(response, encoding).catch(
              (err) => `<Response error: ${String(err)}>`,
            ),
          },
        },
      )
    }

    // Validate response body
    if (output.encoding && output.schema && !options.skipVerification) {
      // @NOTE Schemas validation (`validator.parse(...)`) will automatically
      // coerce encoded Lex values (e.g. LexLinks, LexBytes) when validating
      // JSON, allowing to avoid having to convert to Lex first. This allows a
      // performance gain as only relevant parts of the response body will be
      // checked for coercion during validation, instead of the whole body.
      const body = await readXrpcResponseBody(response, output.encoding).catch(
        (err) => {
          // TODO 400 error
          throw new Error('Failed to read response body', { cause: err })
        },
      )

      return {
        status: response.status,
        headers: response.headers,
        encoding: output.encoding as InferPayloadEncoding<T['output']>,
        body: output.schema.parse(body),
      }
    }

    // output.encoding is undefined, we expect an empty body
    const body = await readXrpcResponseBody(response, encoding).catch((err) => {
      // TODO 400 error
      throw new Error('Failed to read response body', { cause: err })
    })

    if (output.encoding === undefined && body !== undefined) {
      // @TODO 400 error
      throw new Error('Expected empty response body', {
        cause: { encoding, body },
      })
    }

    return {
      status: response.status,
      headers: response.headers,
      encoding,
      body,
    } as XrpcResponse<T>
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

async function readXrpcResponseBody(
  response: Response,
  encoding: string,
): Promise<Lex>
async function readXrpcResponseBody(
  response: Response,
  encoding: string | undefined,
): Promise<Lex | undefined>
async function readXrpcResponseBody(
  response: Response,
  encoding: string | undefined,
): Promise<Lex | undefined> {
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
      await reader.cancel() // Drain the body
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
