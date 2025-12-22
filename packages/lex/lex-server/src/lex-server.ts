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
  Procedure,
  Query,
  Subscription,
  getMain,
} from '@atproto/lex-schema'

type LexMethod = Query | Procedure | Subscription

type Fetch = (request: Request) => Promise<Response>
type Route = { method: LexMethod; fetch: Fetch }

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

export type LexRouterOptions = {
  upgradeWebSocket?: (request: Request) => {
    socket: WebSocket
    response: Response
  }

  onHandlerError?: (data: {
    error: unknown
    request: Request
    method: LexMethod
  }) => void | null | Response | Promise<void | null | Response>

  onMethodNotFound?: (data: {
    request?: Request
  }) => void | null | Response | Promise<void | null | Response>

  onResponse?: (data: {
    response: Response
    request: Request
    method?: LexMethod
  }) => void | null | Response | Promise<void | null | Response>
}

export class LexRouter {
  private routes: Map<string, Route> = new Map()

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
    if (this.routes.has(method.nsid)) {
      throw new TypeError(`Method ${method.nsid} already registered`)
    }
    const { handler, auth = undefined } =
      typeof config === 'function' ? { handler: config } : config

    const fetch =
      method.type === 'subscription'
        ? this.buildSubscriptionFetch(
            method,
            handler as LexRouterSubHandler<any, any>,
            auth,
          )
        : this.buildFetch(
            method,
            handler as LexRouterMethodHandler<any, any>,
            auth,
          )

    this.routes.set(method.nsid, { method, fetch })

    return this
  }

  private buildFetch<M extends Query | Procedure>(
    method: M,
    handler: LexRouterMethodHandler<M, void>,
    auth?: LexRouterAuth<M, void>,
  ): Fetch
  private buildFetch<M extends Query | Procedure, Credentials>(
    method: M,
    handler: LexRouterMethodHandler<M, Credentials>,
    auth: LexRouterAuth<M, Credentials>,
  ): Fetch
  private buildFetch<M extends Query | Procedure, Credentials>(
    method: M,
    handler: LexRouterMethodHandler<M, Credentials>,
    auth?: LexRouterAuth<M, Credentials>,
  ): Fetch {
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
            headers: output?.headers,
          })
        }

        const responseHeaders = new Headers(output?.headers)
        responseHeaders.set('content-type', output.encoding!)
        return new Response(output.body, {
          status: 200,
          headers: responseHeaders,
        })
      } catch (error) {
        const response = await this.options.onHandlerError?.call(null, {
          request,
          method,
          error,
        })

        if (response != null) {
          return response
        }

        // Ensure request body is closed to free resources
        if (!request.bodyUsed) await request.body?.cancel()

        if (error instanceof LexError) {
          return error.toResponse()
        }

        return Response.json(
          { error: 'InternalError', message: 'An internal error occurred' },
          { status: 500 },
        )
      }
    }
  }

  private buildSubscriptionFetch<M extends Subscription, Credentials>(
    method: M,
    handler: LexRouterSubHandler<M, Credentials>,
    auth?: LexRouterAuth<M, Credentials>,
  ): Fetch {
    return async (request: Request): Promise<Response> => {
      if (request.method !== 'GET') {
        await request.body?.cancel()
        return Response.json(
          { error: 'InvalidRequest', message: 'Method not allowed' },
          { status: 405 },
        )
      }

      if (request.headers.get('upgrade') !== 'websocket') {
        return Response.json(
          {
            error: 'InvalidRequest',
            message: 'Subscription method must use WebSocket upgrade',
          },
          { status: 400 },
        )
      }

      const upgradeWebSocket: (request: Request) => {
        socket: WebSocket
        response: Response
      } =
        this.options.upgradeWebSocket ??
        // @ts-expect-error
        (typeof Deno !== 'undefined' ? Deno.upgradeWebSocket : undefined) ??
        (await import('./nodejs.js')).upgradeWebSocket

      const { response, socket } = upgradeWebSocket(request)

      socket.addEventListener('message', () => {
        socket.close(1008, 'InvalidRequest') // No messages expected
      })

      socket.addEventListener('open', async () => {
        try {
          const url = new URL(request.url)
          const params = method.parameters.fromURLSearchParams(url.searchParams)

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

          // eslint-disable-next-line no-constant-condition
          while (socket.readyState === 1) {
            const result = await iterator.next()
            if (result.done) break

            // Should not be needed (socket would emit "close" event)
            request.signal.throwIfAborted()

            const data = encodeMessage(method, result.value)

            if (socket.send.length === 3) {
              // Node.js WebSocket implementation supports a callback for send,
              // allowing to await backpressure
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
            error instanceof LexError
              ? error
              : new LexError(
                  'InternalError',
                  'An internal error occurred while processing the subscription',
                )

          const data = ui8Concat([
            encode({ op: -1 }),
            encode(lexError.toJSON()),
          ])

          socket.send(data)

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
    }
  }

  async fetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const request =
      input instanceof Request && init == null
        ? input
        : new Request(input, init)
    const url = new URL(request.url)

    const nsid = extractXrpcMethodNsid(url)
    const route = nsid ? this.routes.get(nsid) : null

    const response = route
      ? await route.fetch(request)
      : await this.fallback(request)

    const modifiedResponse = await this.options.onResponse?.call(null, {
      request,
      response,
      method: route?.method,
    })
    if (modifiedResponse) return modifiedResponse

    return response
  }

  async fallback(request: Request): Promise<Response> {
    const fallbackResponse = await this.options.onMethodNotFound?.call(null, {
      request,
    })
    if (fallbackResponse) return fallbackResponse

    return Response.json({ error: 'MethodNotImplemented' }, { status: 404 })
  }
}

function extractXrpcMethodNsid({ pathname }: URL): string | null {
  if (!pathname.startsWith('/xrpc/')) return null
  if (pathname.includes('/', 6)) return null
  if (pathname.length <= 11) return null // "/xrpc/a.b.c" is minimum
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
