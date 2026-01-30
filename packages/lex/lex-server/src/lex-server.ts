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
import { drainWebsocket } from './lib/drain-websocket.js'

type Awaitable<T> = T | Promise<T>
export type LexMethod = Query | Procedure | Subscription

export type NetAddr = {
  hostname: string
  port: number
  transport: 'tcp' | 'udp'
}

export type UnixAddr = {
  path: string
  transport: 'unix' | 'unixpacket'
}

export type Addr = NetAddr | UnixAddr | undefined

export type ConnectionInfo<A extends Addr = Addr> = {
  remoteAddr: A
  completed: Promise<void>
}

export type FetchHandler = (
  request: Request,
  connection?: ConnectionInfo,
) => Promise<Response>

export type LexRouterHandlerContext<Method extends LexMethod, Credentials> = {
  credentials: Credentials
  input: InferMethodInput<Method, Body>
  params: InferMethodParams<Method>
  request: Request
  signal: AbortSignal
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
) => Awaitable<LexRouterHandlerOutput<Method>>

export type LexRouterMethodConfig<
  Method extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = {
  handler: LexRouterMethodHandler<Method, Credentials>
  auth: LexRouterAuth<Credentials, Method>
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
  auth: LexRouterAuth<Credentials, Method>
}

export type LexRouterAuthContext<Method extends LexMethod = LexMethod> = {
  method: Method
  params: InferMethodParams<Method>
  request: Request
  connection?: ConnectionInfo
}

export type LexRouterAuth<
  Credentials = unknown,
  Method extends LexMethod = LexMethod,
> = (ctx: LexRouterAuthContext<Method>) => Credentials | Promise<Credentials>

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
  highWaterMark?: number
  lowWaterMark?: number
}

export class LexRouter {
  private handlers: Map<NsidString, FetchHandler> = new Map()

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
  add<M extends LexMethod, Credentials = unknown>(
    ns: Main<M>,
    config: M extends Subscription
      ?
          | LexRouterSubscriptionHandler<M, Credentials>
          | LexRouterSubscriptionConfig<M, Credentials>
      : M extends Query | Procedure
        ?
            | LexRouterMethodHandler<M, Credentials>
            | LexRouterMethodConfig<M, Credentials>
        : never,
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

    const fetch: FetchHandler =
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

    this.handlers.set(method.nsid, fetch)

    return this
  }

  private buildMethodHandler<Method extends Query | Procedure, Credentials>(
    method: Method,
    methodHandler: LexRouterMethodHandler<Method, Credentials>,
    auth?: LexRouterAuth<Credentials, Method>,
  ): FetchHandler {
    const getInput = (
      method.type === 'procedure'
        ? getProcedureInput.bind(method)
        : getQueryInput.bind(method)
    ) as (request: Request) => Promise<InferMethodInput<Method, Body>>

    return async (request, connection) => {
      // @NOTE CORS requests should be handled by a middleware before reaching
      // this point.
      if (
        (method.type === 'procedure' && request.method !== 'POST') ||
        (method.type === 'query' &&
          request.method !== 'GET' &&
          request.method !== 'HEAD')
      ) {
        return Response.json(
          { error: 'InvalidRequest', message: 'Method not allowed' },
          { status: 405 },
        )
      }

      try {
        const url = new URL(request.url)
        const params = method.parameters.fromURLSearchParams(url.searchParams)

        const credentials = auth
          ? await auth({ method, params, request, connection })
          : (undefined as Credentials)

        const input = await getInput(request)

        const output = await methodHandler({
          credentials,
          params,
          input,
          request,
          connection,
          signal: request.signal,
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
        return new Response(output.body as BodyInit | null | undefined, {
          status: 200,
          headers,
        })
      } catch (error) {
        return this.handleError(request, method, error)
      }
    }
  }

  private buildSubscriptionHandler<Method extends Subscription, Credentials>(
    method: Method,
    methodHandler: LexRouterSubscriptionHandler<Method, Credentials>,
    auth?: LexRouterAuth<Credentials, Method>,
  ): FetchHandler {
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

    return async (request, connection) => {
      if (request.method !== 'GET') {
        return Response.json(
          { error: 'InvalidRequest', message: 'Method not allowed' },
          { status: 405 },
        )
      }

      if (
        request.headers.get('connection')?.toLowerCase() !== 'upgrade' ||
        request.headers.get('upgrade')?.toLowerCase() !== 'websocket'
      ) {
        return Response.json(
          {
            error: 'InvalidRequest',
            message: 'XRPC subscriptions are only available over WebSocket',
          },
          {
            status: 426,
            headers: {
              Connection: 'Upgrade',
              Upgrade: 'websocket',
            },
          },
        )
      }

      if (request.signal.aborted) {
        return Response.json(
          { error: 'RequestAborted', message: 'The request was aborted' },
          { status: 499 },
        )
      }

      try {
        const { response, socket } = upgradeWebSocket(request)

        // @NOTE We are using a distinct signal than request.signal because that
        // signal may get aborted before the WebSocket is closed (this is the
        // case with Deno).
        const abortController = new AbortController()
        const { signal } = abortController
        const abort = () => abortController.abort()

        const onMessage = (event: unknown) => {
          const error = new LexError(
            'InvalidRequest',
            'XRPC subscriptions do not accept messages',
            { cause: event },
          )
          socket.send(encodeErrorFrame(error))
          socket.close(1008, error.error)
        }

        const onOpen = async () => {
          try {
            const url = new URL(request.url)
            const params = method.parameters.fromURLSearchParams(
              url.searchParams,
            )

            const credentials: Credentials = auth
              ? await auth({ method, params, request, connection })
              : (undefined as Credentials)

            signal.throwIfAborted()

            const iterable = methodHandler({
              credentials,
              params,
              input: undefined as InferMethodInput<Method, Body>,
              request,
              connection,
              signal,
            })

            const iterator = iterable[Symbol.asyncIterator]()

            signal.addEventListener('abort', async () => {
              // @NOTE will cause the process to crash if this throws
              await iterator.return?.()
            })

            while (!signal.aborted && socket.readyState === 1) {
              const result = await iterator.next()
              if (result.done) break

              // @TODO add validation of output based on method.output.schema?

              const data = encodeMessageFrame(method, result.value)

              socket.send(data)

              // Apply backpressure by waiting for the buffered data to drain
              // before generating the next message
              await drainWebsocket(socket, signal, this.options)
            }

            if (socket.readyState === 1) {
              socket.close(1000)
            }
          } catch (error) {
            // If the socket is still open, send an error frame before closing
            if (socket.readyState === 1) {
              const lexError =
                error instanceof LexError
                  ? error
                  : new LexError('InternalError', 'An internal error occurred')

              socket.send(encodeErrorFrame(lexError))

              socket.close(
                // https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
                error instanceof LexError ? 1008 : 1011,
                lexError.error,
              )
            }

            // Only report unexpected processing errors
            if (onHandlerError && !isAbortReason(request.signal, error)) {
              await onHandlerError({ error, request, method })
            }
          } finally {
            abortController.abort()
          }
        }

        socket.addEventListener('error', abort)
        socket.addEventListener('close', abort)
        socket.addEventListener('open', onOpen)
        socket.addEventListener('message', onMessage)

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
    // Only report unexpected processing errors
    const { onHandlerError } = this.options
    if (onHandlerError && !isAbortReason(request.signal, error)) {
      await onHandlerError({ error, request, method })
    }

    if (error instanceof LexError) {
      return error.toResponse()
    }

    return Response.json(
      { error: 'InternalError', message: 'An internal error occurred' },
      { status: 500 },
    )
  }

  fetch: FetchHandler = async (
    request: Request,
    connection?: ConnectionInfo,
  ): Promise<Response> => {
    const nsid = extractMethodNsid(request)

    const fetch = nsid
      ? (this.handlers as Map<unknown, FetchHandler>).get(nsid)
      : undefined
    if (fetch) return fetch(request, connection)

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

function extractMethodNsid(request: Request): string | null {
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
    throw new LexError('InvalidRequest', `Invalid content-type: ${encoding}`)
  }

  if (this.input.encoding === 'application/json') {
    // @TODO limit size?
    const data = lexParse(await request.text())
    const body = this.input.schema ? this.input.schema.parse(data) : data
    return { encoding, body } as InferMethodInput<M, Body>
  } else if (this.input.encoding) {
    const body: Body = request
    return { encoding, body } as InferMethodInput<M, Body>
  } else {
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
