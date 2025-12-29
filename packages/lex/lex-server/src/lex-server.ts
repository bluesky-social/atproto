import { encode } from '@atproto/lex-cbor'
import { LexError, LexValue, isPlainObject, ui8Concat } from '@atproto/lex-data'
import { lexParse, lexToJson } from '@atproto/lex-json'
import {
  InferMethodInput,
  InferMethodMessage,
  InferMethodOutput,
  InferMethodOutputBody,
  InferMethodOutputEncoding,
  InferMethodParams,
  Main,
  NsidString,
  Procedure,
  Query,
  Subscription,
  getMain,
  isNsidString,
} from '@atproto/lex-schema'

type LexMethod = Query | Procedure | Subscription

export type NetAddr = {
  hostname: string
  port: number
  transport: 'tcp' | 'udp'
}

export type UnixAddr = {
  path: string
  transport: 'unix' | 'unixpacket'
}

export type Addr = NetAddr | UnixAddr

export type ConnectionInfo = {
  localAddr?: Addr
  remoteAddr?: Addr
}

type Handler = (
  request: Request,
  connection?: ConnectionInfo,
) => Promise<Response>

export type LexRouterHandlerContext<Method extends LexMethod, Credentials> = {
  credentials: Credentials
  input: InferMethodInput<Method, Body>
  params: InferMethodParams<Method>
  request: Request
  connection?: ConnectionInfo
}

type AsOptionalPayloadOptions<T> = T extends undefined | void
  ? { encoding?: undefined; body?: undefined }
  : T

export type LexRouterHandlerOutput<Method extends Query | Procedure> =
  | Response
  | ({
      headers?: HeadersInit
    } & (InferMethodOutputEncoding<Method> extends 'application/json'
      ? {
          // Allow omitting body when output is JSON
          encoding?: 'application/json'
          body: InferMethodOutputBody<Method>
        }
      : AsOptionalPayloadOptions<InferMethodOutput<Method, BodyInit>>))

export type LexRouterMethodHandler<
  Method extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = (
  ctx: LexRouterHandlerContext<Method, Credentials>,
) => Promise<LexRouterHandlerOutput<Method>>

export type LexRouterMethodConfig<
  Method extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = {
  handler: LexRouterMethodHandler<Method, Credentials>
  auth: LexRouterAuth<Method, Credentials>
}

export type LexRouterSubscriptionHandler<
  Method extends Subscription = Subscription,
  Credentials = unknown,
> = (
  ctx: LexRouterHandlerContext<Method, Credentials>,
) => AsyncIterable<InferMethodMessage<Method>>

export type LexRouterSubscriptionConfig<
  Method extends Subscription = Subscription,
  Credentials = unknown,
> = {
  handler: LexRouterSubscriptionHandler<Method, Credentials>
  auth: LexRouterAuth<Method, Credentials>
}

export type LexRouterAuthContext<Method extends LexMethod = LexMethod> = {
  params: InferMethodParams<Method>
  request: Request
  connection?: ConnectionInfo
}

export type LexRouterAuth<
  Method extends LexMethod = LexMethod,
  Credentials = unknown,
> = (ctx: LexRouterAuthContext<Method>) => Promise<Credentials>

export type LexErrorHandlerContext = {
  error: unknown
  request: Request
  method: LexMethod
}

export type UpgradeWebSocket = (request: Request) => {
  socket: WebSocket
  response: Response
}

export type LexRouterOptions = {
  upgradeWebSocket?: UpgradeWebSocket
  onHandlerError?: (ctx: LexErrorHandlerContext) => void | Promise<void>
}

export class LexRouter {
  private handlers: Map<NsidString, Handler> = new Map()

  constructor(readonly options: LexRouterOptions = {}) {}

  add<M extends Subscription>(
    ns: Main<M>,
    handler: LexRouterSubscriptionHandler<M, void>,
  ): this
  add<M extends Subscription, Credentials>(
    ns: Main<M>,
    config: LexRouterSubscriptionConfig<M, Credentials>,
  ): this
  add<M extends Query | Procedure>(
    ns: Main<M>,
    handler: LexRouterMethodHandler<M, void>,
  ): this
  add<M extends Query | Procedure, Credentials>(
    ns: Main<M>,
    config: LexRouterMethodConfig<M, Credentials>,
  ): this
  add<M extends LexMethod>(
    ns: Main<M>,
    config:
      | LexRouterSubscriptionHandler<any, any>
      | LexRouterSubscriptionConfig<any, any>
      | LexRouterMethodHandler<any, any>
      | LexRouterMethodConfig<any, any>,
  ) {
    const method = getMain(ns)
    if (this.handlers.has(method.nsid)) {
      throw new TypeError(`Method ${method.nsid} already registered`)
    }
    const methodConfig =
      typeof config === 'function'
        ? { handler: config, auth: undefined }
        : config

    const handler: Handler =
      method.type === 'subscription'
        ? this.buildSubscriptionHandler(
            method,
            methodConfig.handler as LexRouterSubscriptionHandler<any, any>,
            methodConfig.auth,
          )
        : this.buildMethodHandler(
            method,
            methodConfig.handler as LexRouterMethodHandler<any, any>,
            methodConfig.auth,
          )

    this.handlers.set(method.nsid, handler)

    return this
  }

  private buildMethodHandler<Method extends Query | Procedure, Credentials>(
    method: Method,
    methodHandler: LexRouterMethodHandler<Method, Credentials>,
    auth?: LexRouterAuth<Method, Credentials>,
  ): Handler {
    const getInput = (
      method.type === 'procedure'
        ? getProcedureInput.bind(method)
        : getQueryInput.bind(method)
    ) as (request: Request) => Promise<InferMethodInput<Method, Body>>

    return async (
      request: Request,
      connection?: ConnectionInfo,
    ): Promise<Response> => {
      if (
        (method.type === 'procedure' && request.method !== 'POST') ||
        (method.type === 'query' &&
          request.method !== 'GET' &&
          request.method !== 'HEAD')
      ) {
        await request.body?.cancel()
        return Response.json(
          { error: 'InvalidRequest', message: 'Method not allowed' },
          { status: 405 },
        )
      }

      try {
        const url = new URL(request.url)
        const params = method.parameters.fromURLSearchParams(url.searchParams)

        const credentials = auth
          ? await auth({ params, request, connection })
          : (undefined as Credentials)

        const input = await getInput(request)

        const output = await methodHandler({
          credentials,
          params,
          input,
          request,
          connection,
        })

        if (output instanceof Response) {
          return output
        }

        // @TODO add validation of output based on method.output.schema?

        if (output.body === undefined && output.encoding === undefined) {
          return new Response(null, { status: 200, headers: output.headers })
        }

        if (method.output?.encoding === 'application/json') {
          return Response.json(lexToJson(output.body as LexValue), {
            status: 200,
            headers: output.headers,
          })
        }

        const headers = new Headers(output.headers)
        headers.set('content-type', output.encoding!)
        return new Response(output.body, { status: 200, headers })
      } catch (error) {
        return this.handleError(request, method, error)
      }
    }
  }

  private buildSubscriptionHandler<Method extends Subscription, Credentials>(
    method: Method,
    methodHandler: LexRouterSubscriptionHandler<Method, Credentials>,
    auth?: LexRouterAuth<Method, Credentials>,
  ): Handler {
    const {
      onHandlerError,
      upgradeWebSocket = (globalThis as any).Deno?.upgradeWebSocket as
        | UpgradeWebSocket
        | undefined,
    } = this.options
    if (!upgradeWebSocket) {
      throw new TypeError(
        'WebSocket upgrade not supported in this environment. Please provide an upgradeWebSocket option when creating the LexRouter.',
      )
    }

    return async (
      request: Request,
      connection?: ConnectionInfo,
    ): Promise<Response> => {
      if (request.method !== 'GET') {
        await request.body?.cancel()
        return Response.json(
          { error: 'InvalidRequest', message: 'Method not allowed' },
          { status: 405 },
        )
      }

      if (request.headers.get('upgrade') !== 'websocket') {
        await request.body?.cancel()
        return Response.json(
          {
            error: 'InvalidRequest',
            message: 'Subscription method must use WebSocket upgrade',
          },
          { status: 400 },
        )
      }

      try {
        const { response, socket } = upgradeWebSocket(request)

        socket.addEventListener('message', () => {
          const error = new LexError(
            'InvalidRequest',
            'XRPC subscriptions do not accept messages',
          )
          socket.send(encodeErrorFrame(error))
          socket.close(1008, error.error)
        })

        socket.addEventListener('open', async () => {
          try {
            const url = new URL(request.url)
            const params = method.parameters.fromURLSearchParams(
              url.searchParams,
            )

            const credentials: Credentials = auth
              ? await auth({ params, request, connection })
              : (undefined as Credentials)

            request.signal.throwIfAborted()

            const iterable = methodHandler({
              credentials,
              params,
              input: undefined as InferMethodInput<Method, Body>,
              request,
              connection,
            })

            const iterator = iterable[Symbol.asyncIterator]()

            if (iterator.return) {
              const abort = async () => {
                socket.removeEventListener('error', abort)
                socket.removeEventListener('close', abort)
                try {
                  await iterator.return!()
                } catch {
                  // Ignore
                }
              }
              socket.addEventListener('error', abort)
              socket.addEventListener('close', abort)
            }

            while (socket.readyState === 1) {
              const result = await iterator.next()
              if (result.done) break

              // Should not be needed (socket would emit "close" event)
              request.signal.throwIfAborted()

              // @TODO add validation of output based on method.output.schema?

              const data = encodeMessageFrame(method, result.value)

              socket.send(data)

              // Apply backpressure based on WebSocket bufferedAmount (uses
              // polling).
              await flowControl(socket, request.signal)
            }

            socket.close(1000)
          } catch (error) {
            // If the socket is still open, send an error frame before closing
            if (socket.readyState === 1) {
              const lexError =
                error instanceof LexError
                  ? error
                  : new LexError('InternalError', 'An internal error occurred')

              socket.send(encodeErrorFrame(lexError))

              // https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
              socket.close(1008, lexError.error)
            }

            // Only report unexpected processing errors
            if (onHandlerError && !isAbortReason(request.signal, error)) {
              await onHandlerError({ error, request, method })
            }
          }
        })

        return response
      } catch (error) {
        return this.handleError(request, method, error)
      }
    }
  }

  private async handleError(
    request: Request,
    method: LexMethod,
    error: unknown,
  ) {
    try {
      // Only report unexpected processing errors
      const { onHandlerError } = this.options
      if (onHandlerError && !isAbortReason(request.signal, error)) {
        await onHandlerError({ error, request, method })
      }
    } finally {
      if (!request.bodyUsed) await request.body?.cancel()
    }

    if (error instanceof LexError) {
      return error.toResponse()
    }

    return Response.json(
      { error: 'InternalError', message: 'An internal error occurred' },
      { status: 500 },
    )
  }

  handle: Handler = async (
    request: Request,
    connection?: ConnectionInfo,
  ): Promise<Response> => {
    const nsid = extractXrpcMethodNsid(request)

    const handler = (this.handlers as Map<string | null, Handler>).get(nsid)
    if (handler) return handler(request, connection)

    await request.body?.cancel()

    if (!nsid || !isNsidString(nsid)) {
      return Response.json(
        {
          error: 'InvalidRequest',
          message: 'Invalid XRPC method path',
        },
        { status: 404 },
      )
    }

    return Response.json(
      {
        error: 'MethodNotImplemented',
        message: `XRPC method "${nsid}" not implemented on this server`,
      },
      { status: 501 },
    )
  }
}

function extractXrpcMethodNsid(request: Request): string | null {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith('/xrpc/')) return null
  if (pathname.includes('/', 6)) return null
  // We don't really need to validate the NSID here, the existence of the route
  // (which is looked up based on an NSID) is sufficient.
  return pathname.slice(6)
}

async function getProcedureInput<M extends Procedure>(
  this: M,
  request: Request,
): Promise<InferMethodInput<M, Body>> {
  const encodingRaw = request.headers
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase()

  const encoding =
    encodingRaw ||
    // If the caller did not provide a content-type, but the method
    // expects an input, assume binary
    (request.body != null && this.input.encoding != null
      ? 'application/octet-stream'
      : undefined)

  if (!this.input.matchesEncoding(encoding)) {
    await request.body?.cancel()
    throw new LexError('InvalidRequest', `Invalid content-type: ${encoding}`)
  }

  if (this.input.encoding === 'application/json') {
    // @TODO limit size?
    const body = this.input.schema
      ? this.input.schema.parse(lexParse(await request.text()))
      : lexParse(await request.text())
    return { encoding, body } as InferMethodInput<M, Body>
  } else if (this.input.encoding) {
    const body: Body = request
    return { encoding, body } as InferMethodInput<M, Body>
  } else {
    await request.body?.cancel()
    return undefined as InferMethodInput<M, Body>
  }
}

async function getQueryInput<M extends Query>(
  this: M,
  request: Request,
): Promise<InferMethodInput<M, Body>> {
  if (
    request.body ||
    request.headers.has('content-type') ||
    request.headers.has('content-length')
  ) {
    await request.body?.cancel()
    throw new LexError('InvalidRequest', 'GET requests must not have a body')
  }

  return undefined as InferMethodInput<M, Body>
}

// Pre-encoded frame header for error frames
const ERROR_FRAME_HEADER = /*#__PURE__*/ encode({ op: -1 })

function encodeErrorFrame(error: LexError): Uint8Array {
  return ui8Concat([ERROR_FRAME_HEADER, encode(error.toJSON())])
}

// Pre-encoded frame header for message frames with unknown type
const UNKNOWN_MESSAGE_FRAME_HEADER = /*#__PURE__*/ encode({ op: 1 })

function encodeMessageFrame(method: Subscription, value: LexValue): Uint8Array {
  if (isPlainObject(value) && typeof value.$type === 'string') {
    const { $type, ...rest } = value
    return ui8Concat([
      encode({
        op: 1,
        t:
          // If $type starts with `nsid#`, strip the NSID prefix
          $type.charCodeAt(0) !== 0x23 && // '#'
          $type.charCodeAt(method.nsid.length) === 0x23 && // '#'
          $type.startsWith(method.nsid)
            ? $type.slice(method.nsid.length)
            : $type,
      }),
      encode(rest),
    ])
  }

  return ui8Concat([UNKNOWN_MESSAGE_FRAME_HEADER, encode(value)])
}

function isAbortReason(signal: AbortSignal, error: unknown): boolean {
  if (!signal.aborted || signal.reason == null) return false
  return (
    error === signal.reason ||
    (error instanceof Error && error.cause === signal.reason)
  )
}

const HIGH_WATER_MARK = 250_000 // 250 KB
const LOW_WATER_MARK = 50_000 // 50 KB

async function flowControl(
  socket: WebSocket,
  signal: AbortSignal,
): Promise<void> {
  if (socket.bufferedAmount > HIGH_WATER_MARK) {
    while (socket.readyState === 1 && socket.bufferedAmount > LOW_WATER_MARK) {
      await sleep(10, signal)
    }
  }
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timeout)
      reject(signal.reason)
    }

    signal.addEventListener('abort', onAbort)
  })
}
