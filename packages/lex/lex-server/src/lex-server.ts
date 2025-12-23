import { encode } from '@atproto/lex-cbor'
import { LexError, LexValue, isLexMap, ui8Concat } from '@atproto/lex-data'
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

type Handler = (request: Request) => Promise<Response>

export type LexRouterHandlerContext<M extends LexMethod, Credentials = void> = {
  credentials: Credentials
  input: InferMethodInput<M, Body>
  params: InferMethodParams<M>
  request: Request
}

type AsOptionalPayloadOptions<T> = T extends undefined | void
  ? { encoding?: undefined; body?: undefined }
  : T

export type LexRouterHandlerOutput<M extends Query | Procedure> =
  | Response
  | ({
      headers?: HeadersInit
    } & (InferMethodOutputEncoding<M> extends 'application/json'
      ? {
          // Allow omitting body when output is JSON
          encoding?: 'application/json'
          body: InferMethodOutputBody<M>
        }
      : AsOptionalPayloadOptions<InferMethodOutput<M, BodyInit>>))

export type LexRouterMethodHandler<
  M extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = (
  ctx: LexRouterHandlerContext<M, Credentials>,
) => Promise<LexRouterHandlerOutput<M>>

export type LexRouterMethodConfig<
  M extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = {
  handler: LexRouterMethodHandler<M, Credentials>
  auth: LexRouterAuth<M, Credentials>
}

export type LexRouterSubHandler<
  M extends Subscription = Subscription,
  Credentials = unknown,
> = (
  ctx: LexRouterHandlerContext<M, Credentials>,
) => AsyncIterable<InferMethodMessage<M>>

export type LexRouterSubConfig<
  M extends Subscription = Subscription,
  Credentials = unknown,
> = {
  handler: LexRouterSubHandler<M, Credentials>
  auth: LexRouterAuth<M, Credentials>
}

export type LexRouterAuthContext<M extends LexMethod = LexMethod> = {
  params: InferMethodParams<M>
  request: Request
}

export type LexRouterAuth<
  M extends LexMethod = LexMethod,
  Credentials = unknown,
> = (ctx: LexRouterAuthContext<M>) => Promise<Credentials>

export type LexErrorHandlerContext = {
  error: unknown
  request: Request
  method: LexMethod
}

export type LexRouterOptions = {
  upgradeWebSocket?: (request: Request) => {
    socket: WebSocket
    response: Response
  }

  onHandlerError?: (ctx: LexErrorHandlerContext) => void | Promise<void>
}

export class LexRouter {
  private handlers: Map<NsidString, Handler> = new Map()

  constructor(readonly options: LexRouterOptions = {}) {}

  add<M extends Subscription>(
    ns: Main<M>,
    handler: LexRouterSubHandler<M, void>,
  ): this
  add<M extends Subscription, Credentials>(
    ns: Main<M>,
    config: LexRouterSubConfig<M, Credentials>,
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
      | LexRouterSubHandler<any, any>
      | LexRouterSubConfig<any, any>
      | LexRouterMethodHandler<any, any>
      | LexRouterMethodConfig<any, any>,
  ) {
    const method = getMain(ns)
    if (this.handlers.has(method.nsid)) {
      throw new TypeError(`Method ${method.nsid} already registered`)
    }
    const { handler, auth = undefined } =
      typeof config === 'function' ? { handler: config } : config

    const builtHandler =
      method.type === 'subscription'
        ? this.buildSubscriptionHandler(
            method,
            handler as LexRouterSubHandler<any, any>,
            auth,
          )
        : this.buildMethodHandler(
            method,
            handler as LexRouterMethodHandler<any, any>,
            auth,
          )

    this.handlers.set(method.nsid, builtHandler)

    return this
  }

  private buildMethodHandler<M extends Query | Procedure>(
    method: M,
    handler: LexRouterMethodHandler<M, void>,
    auth?: LexRouterAuth<M, void>,
  ): Handler
  private buildMethodHandler<M extends Query | Procedure, Credentials>(
    method: M,
    handler: LexRouterMethodHandler<M, Credentials>,
    auth: LexRouterAuth<M, Credentials>,
  ): Handler
  private buildMethodHandler<M extends Query | Procedure, Credentials>(
    method: M,
    handler: LexRouterMethodHandler<M, Credentials>,
    auth?: LexRouterAuth<M, Credentials>,
  ): Handler {
    const getInput = (
      method.type === 'procedure'
        ? getProcedureInput.bind(method)
        : getQueryInput.bind(method)
    ) as (request: Request) => Promise<InferMethodInput<M, Body>>

    return async (request: Request): Promise<Response> => {
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
          ? await auth({ params, request })
          : (undefined as Credentials)

        const input = await getInput(request)

        const output = await handler({ credentials, params, input, request })

        if (output instanceof Response) {
          return output
        }

        // @NOTE we don't validate the output here, as it should be the
        // responsibility of the handler to ensure it returns valid output.

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

  private buildSubscriptionHandler<M extends Subscription, Credentials>(
    method: M,
    handler: LexRouterSubHandler<M, Credentials>,
    auth?: LexRouterAuth<M, Credentials>,
  ): Handler {
    const { upgradeWebSocket } = this.options
    if (!upgradeWebSocket) {
      throw new TypeError(
        'WebSocket upgrade not supported in this environment. Please provide an upgradeWebSocket function in the options.',
      )
    }

    return async (request: Request): Promise<Response> => {
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
          socket.send(encodeError(error))
          socket.close(1008, error.error)
        })

        socket.addEventListener('open', async () => {
          try {
            const url = new URL(request.url)
            const params = method.parameters.fromURLSearchParams(
              url.searchParams,
            )

            const credentials: Credentials = auth
              ? await auth({ params, request })
              : (undefined as Credentials)

            request.signal.throwIfAborted()

            const iterable = handler({
              credentials,
              params,
              input: undefined as InferMethodInput<M, Body>,
              request,
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

              const data = encodeMessage(method, result.value)

              if (socket.send.length === 3) {
                // Node.js WebSocket implementation supports a callback for
                // send(), allowing to await backpressure
                await new Promise<void>((resolve, reject) => {
                  // @ts-expect-error
                  socket.send(data, undefined, (err) => {
                    if (err) reject(err)
                    else resolve()
                  })
                })
              } else {
                await socket.send(data)
              }
            }

            socket.close(1000)
          } catch (error) {
            if (socket.readyState !== 1) return

            const lexError =
              error instanceof LexError ? error : new LexError('InternalError')

            socket.send(encodeError(lexError))

            // https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
            socket.close(1008, lexError.error)

            // Only report unexpected processing errors
            if (error !== request.signal.reason) {
              this.options?.onHandlerError?.call(null, {
                error,
                request,
                method,
              })
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
      if (error !== request.signal.reason) {
        const { onHandlerError } = this.options
        if (onHandlerError) {
          await onHandlerError({ request, method, error })
        }
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

  handle: Handler = async (request) => {
    const nsid = extractXrpcMethodNsid(request)

    const handler = (this.handlers as Map<string | null, Handler>).get(nsid)
    if (handler) return handler(request)

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

function encodeError(error: LexError): Uint8Array {
  return ui8Concat([encode({ op: -1 }), encode(error.toJSON())])
}

function encodeMessage(method: Subscription, value: LexValue): Uint8Array {
  if (isLexMap(value) && typeof value.$type === 'string') {
    const { $type, ...rest } = value
    return ui8Concat([
      encode({
        op: 1,
        t:
          $type.charCodeAt(0) !== 0x23 && // '#'
          $type.charCodeAt(method.nsid.length) === 0x23 && // '#'
          $type.startsWith(method.nsid)
            ? $type.slice(method.nsid.length)
            : $type,
      }),
      encode(rest),
    ])
  }

  return ui8Concat([encode({ op: 1 }), encode(value)])
}
