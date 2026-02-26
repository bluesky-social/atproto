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

/**
 * Union type representing the supported Lexicon method types.
 *
 * - `Query`: Read-only methods invoked via HTTP GET
 * - `Procedure`: Methods that may modify state, invoked via HTTP POST
 * - `Subscription`: Real-time streaming methods over WebSocket
 */
export type LexMethod = Query | Procedure | Subscription

/**
 * Network address for TCP or UDP connections.
 *
 * @example
 * ```typescript
 * const addr: NetAddr = {
 *   hostname: '127.0.0.1',
 *   port: 3000,
 *   transport: 'tcp'
 * }
 * ```
 */
export type NetAddr = {
  /** The hostname or IP address of the connection. */
  hostname: string
  /** The port number of the connection. */
  port: number
  /** The transport protocol used. */
  transport: 'tcp' | 'udp'
}

/**
 * Unix domain socket address.
 *
 * @example
 * ```typescript
 * const addr: UnixAddr = {
 *   path: '/var/run/app.sock',
 *   transport: 'unix'
 * }
 * ```
 */
export type UnixAddr = {
  /** The filesystem path to the Unix socket. */
  path: string
  /** The transport protocol used. */
  transport: 'unix' | 'unixpacket'
}

/**
 * Union type for all supported address types.
 *
 * Can be a network address ({@link NetAddr}), Unix socket address ({@link UnixAddr}),
 * or `undefined` when the address is not available.
 */
export type Addr = NetAddr | UnixAddr | undefined

/**
 * Metadata about the client connection for an incoming request.
 *
 * @typeParam A - The address type, defaults to {@link Addr}
 *
 * @example
 * ```typescript
 * const info: ConnectionInfo<NetAddr> = {
 *   remoteAddr: { hostname: '192.168.1.1', port: 54321, transport: 'tcp' },
 *   completed: new Promise((resolve) => socket.on('close', resolve))
 * }
 * ```
 */
export type ConnectionInfo<A extends Addr = Addr> = {
  /** The remote address of the client, if available. */
  remoteAddr: A
  /** Promise that resolves when the connection is fully closed. */
  completed: Promise<void>
}

/**
 * Function signature for handling HTTP requests in the XRPC router.
 *
 * This is the standard fetch-style handler that processes incoming requests
 * and returns responses. It is used both internally by the router and can
 * be used to integrate with other HTTP frameworks.
 *
 * @param request - The incoming HTTP request
 * @param connection - Optional connection metadata including remote address
 * @returns A promise resolving to the HTTP response
 *
 * @example
 * ```typescript
 * const handler: FetchHandler = async (request, connection) => {
 *   console.log('Request from:', connection?.remoteAddr)
 *   return new Response('Hello, World!')
 * }
 * ```
 */
export type FetchHandler = (
  request: Request,
  connection?: ConnectionInfo,
) => Promise<Response>

/**
 * Context object passed to XRPC method handlers.
 *
 * Contains all the information needed to process a request, including
 * parsed parameters, authentication credentials, and the raw request object.
 *
 * @typeParam Method - The Lexicon method type (Query, Procedure, or Subscription)
 * @typeParam Credentials - The type of authentication credentials, determined by the auth handler
 *
 * @example
 * ```typescript
 * const handler: LexRouterMethodHandler<MyMethod, UserCredentials> = async (ctx) => {
 *   const { credentials, params, input, signal } = ctx
 *   // credentials.userId is available if auth handler returns UserCredentials
 *   // params contains validated query parameters
 *   // input contains the request body (for procedures)
 *   // signal can be used to abort long-running operations
 *   return { body: { result: 'success' } }
 * }
 * ```
 */
export type LexRouterHandlerContext<Method extends LexMethod, Credentials> = {
  /** Authentication credentials returned by the auth handler. */
  credentials: Credentials
  /** Parsed and validated request input (body for procedures, undefined for queries). */
  input: InferMethodInput<Method, Body>
  /** Parsed and validated URL query parameters. */
  params: InferMethodParams<Method>
  /** The original HTTP request object. */
  request: Request
  /** Abort signal that is triggered when the request is cancelled. */
  signal: AbortSignal
  /** Connection metadata including remote address. */
  connection?: ConnectionInfo
}

type AsOptionalPayloadOptions<T> = T extends undefined | void
  ? { encoding?: undefined; body?: undefined }
  : T

/**
 * Return type for XRPC method handlers (queries and procedures).
 *
 * Handlers can return either:
 * - A raw {@link Response} object for full control over the HTTP response
 * - An object with `body`, optional `encoding`, and optional `headers`
 *
 * For JSON methods, the body is automatically serialized. For other encodings,
 * the body must be a valid {@link BodyInit} type.
 *
 * @typeParam Method - The Lexicon method type (Query or Procedure)
 *
 * @example
 * ```typescript
 * // Return JSON body (most common)
 * return { body: { users: [...] } }
 *
 * // Return with custom headers
 * return {
 *   body: { data: 'value' },
 *   headers: { 'Cache-Control': 'max-age=3600' }
 * }
 *
 * // Return raw Response for full control
 * return new Response(binaryData, {
 *   headers: { 'Content-Type': 'application/octet-stream' }
 * })
 * ```
 */
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

/**
 * Handler function for XRPC query and procedure methods.
 *
 * Receives a context object with request details and credentials,
 * and returns either a Response or a structured output object.
 *
 * @typeParam Method - The Lexicon method type (Query or Procedure)
 * @typeParam Credentials - The type of authentication credentials
 *
 * @example
 * ```typescript
 * const getProfile: LexRouterMethodHandler<GetProfileMethod, UserCredentials> = async (ctx) => {
 *   const profile = await db.getProfile(ctx.params.actor)
 *   return { body: profile }
 * }
 * ```
 */
export type LexRouterMethodHandler<
  Method extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = (
  ctx: LexRouterHandlerContext<Method, Credentials>,
) => Awaitable<LexRouterHandlerOutput<Method>>

/**
 * Configuration object for registering an XRPC method with authentication.
 *
 * Used when you need to specify both a handler and an auth function.
 *
 * @typeParam Method - The Lexicon method type (Query or Procedure)
 * @typeParam Credentials - The type of authentication credentials
 *
 * @example
 * ```typescript
 * const config: LexRouterMethodConfig<GetProfileMethod, UserCredentials> = {
 *   handler: async (ctx) => {
 *     return { body: await getProfile(ctx.params.actor) }
 *   },
 *   auth: async ({ request }) => {
 *     return verifyToken(request.headers.get('authorization'))
 *   }
 * }
 * ```
 */
export type LexRouterMethodConfig<
  Method extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = {
  /** The handler function that processes the request. */
  handler: LexRouterMethodHandler<Method, Credentials>
  /** Authentication function that validates credentials before the handler runs. */
  auth: LexRouterAuth<Credentials, Method>
}

/**
 * Handler function for XRPC subscription methods (WebSocket streams).
 *
 * Returns an async iterable that yields messages to be sent over the WebSocket.
 * The connection remains open until the iterable completes or an error occurs.
 *
 * @typeParam Method - The Lexicon subscription method type
 * @typeParam Credentials - The type of authentication credentials
 *
 * @example
 * ```typescript
 * const subscribeRepos: LexRouterSubscriptionHandler<SubscribeReposMethod> = async function* (ctx) {
 *   const cursor = ctx.params.cursor ?? 0
 *   for await (const event of eventStream.since(cursor)) {
 *     if (ctx.signal.aborted) break
 *     yield { $type: 'com.atproto.sync.subscribeRepos#commit', ...event }
 *   }
 * }
 * ```
 */
export type LexRouterSubscriptionHandler<
  Method extends Subscription = Subscription,
  Credentials = unknown,
> = (
  ctx: LexRouterHandlerContext<Method, Credentials>,
) => AsyncIterable<InferMethodMessage<Method>>

/**
 * Configuration object for registering an XRPC subscription with authentication.
 *
 * Used when you need to specify both a handler and an auth function for subscriptions.
 *
 * @typeParam Method - The Lexicon subscription method type
 * @typeParam Credentials - The type of authentication credentials
 *
 * @example
 * ```typescript
 * const config: LexRouterSubscriptionConfig<SubscribeReposMethod, ServiceCredentials> = {
 *   handler: async function* (ctx) {
 *     for await (const event of eventStream) {
 *       yield event
 *     }
 *   },
 *   auth: async ({ request }) => {
 *     return verifyServiceAuth(request)
 *   }
 * }
 * ```
 */
export type LexRouterSubscriptionConfig<
  Method extends Subscription = Subscription,
  Credentials = unknown,
> = {
  /** The handler function that yields subscription messages. */
  handler: LexRouterSubscriptionHandler<Method, Credentials>
  /** Authentication function that validates credentials before the handler runs. */
  auth: LexRouterAuth<Credentials, Method>
}

/**
 * Context object passed to authentication handlers.
 *
 * Contains the information needed to authenticate a request before
 * the main handler is invoked.
 *
 * @typeParam Method - The Lexicon method type
 *
 * @example
 * ```typescript
 * const authHandler: LexRouterAuth<UserCredentials> = async (ctx) => {
 *   const token = ctx.request.headers.get('authorization')
 *   if (!token) throw new LexError('AuthenticationRequired', 'Missing token')
 *   return { userId: await verifyToken(token) }
 * }
 * ```
 */
export type LexRouterAuthContext<Method extends LexMethod = LexMethod> = {
  /** The Lexicon method definition being called. */
  method: Method
  /** Parsed and validated URL query parameters. */
  params: InferMethodParams<Method>
  /** The original HTTP request object. */
  request: Request
  /** Connection metadata including remote address. */
  connection?: ConnectionInfo
}

/**
 * Authentication handler function for XRPC methods.
 *
 * Called before the main handler to validate authentication credentials.
 * Should return the validated credentials or throw an error if authentication fails.
 *
 * @typeParam Credentials - The type of credentials to return on success
 * @typeParam Method - The Lexicon method type
 *
 * @example
 * ```typescript
 * // Simple token-based auth
 * const tokenAuth: LexRouterAuth<{ userId: string }> = async ({ request }) => {
 *   const token = request.headers.get('authorization')?.replace('Bearer ', '')
 *   if (!token) throw new LexError('AuthenticationRequired', 'Token required')
 *   const userId = await verifyToken(token)
 *   return { userId }
 * }
 *
 * // Using with serviceAuth for AT Protocol service authentication
 * import { serviceAuth } from '@atproto/lex-server'
 * const auth = serviceAuth({ audience: 'did:web:example.com', unique: checkNonce })
 * ```
 */
export type LexRouterAuth<
  Credentials = unknown,
  Method extends LexMethod = LexMethod,
> = (ctx: LexRouterAuthContext<Method>) => Credentials | Promise<Credentials>

/**
 * Context object passed to error handler callbacks.
 *
 * Used for logging and monitoring errors that occur during request handling.
 */
export type LexErrorHandlerContext = {
  /** The error that was thrown during handling. */
  error: unknown
  /** The original HTTP request that triggered the error. */
  request: Request
  /** The Lexicon method that was being executed. */
  method: LexMethod
}

/**
 * Function that upgrades an HTTP request to a WebSocket connection.
 *
 * This is platform-specific: Deno provides this natively, while Node.js
 * requires the `upgradeWebSocket` function from this package.
 *
 * @param request - The HTTP request to upgrade
 * @returns An object containing the WebSocket and the upgrade response
 *
 * @example
 * ```typescript
 * // In Node.js, use the provided upgradeWebSocket function
 * import { upgradeWebSocket } from '@atproto/lex-server/nodejs'
 *
 * const router = new LexRouter({ upgradeWebSocket })
 * ```
 */
export type UpgradeWebSocket = (request: Request) => {
  /** The WebSocket instance for bidirectional communication. */
  socket: WebSocket
  /** The HTTP response to return (101 Switching Protocols). */
  response: Response
}

/**
 * Configuration options for the {@link LexRouter}.
 *
 * @example
 * ```typescript
 * const options: LexRouterOptions = {
 *   upgradeWebSocket,
 *   onHandlerError: async ({ error, request, method }) => {
 *     console.error(`Error in ${method.nsid}:`, error)
 *     await reportToSentry(error)
 *   },
 *   highWaterMark: 64 * 1024,  // 64KB
 *   lowWaterMark: 16 * 1024    // 16KB
 * }
 * ```
 */
export type LexRouterOptions = {
  /**
   * Function to upgrade HTTP requests to WebSocket connections.
   * Required for subscription methods. Defaults to Deno's built-in
   * upgradeWebSocket if available.
   */
  upgradeWebSocket?: UpgradeWebSocket
  /**
   * Callback invoked when an error occurs during request handling.
   * Useful for logging and error reporting. Not called for client-induced
   * errors (e.g., request abortion).
   */
  onHandlerError?: (ctx: LexErrorHandlerContext) => void | Promise<void>
  /**
   * High water mark for WebSocket backpressure (in bytes).
   * When buffered data exceeds this, the handler will wait before sending more.
   */
  highWaterMark?: number
  /**
   * Low water mark for WebSocket backpressure (in bytes).
   * The handler resumes sending when buffered data drops below this.
   */
  lowWaterMark?: number
}

/**
 * XRPC router for handling AT Protocol Lexicon methods.
 *
 * The router handles HTTP routing, parameter parsing, input validation,
 * authentication, and response serialization for XRPC methods. It supports
 * queries (GET), procedures (POST), and subscriptions (WebSocket).
 *
 * @example Setting up a basic XRPC server
 * ```typescript
 * import { LexRouter } from '@atproto/lex-server'
 * import { serve, upgradeWebSocket } from '@atproto/lex-server/nodejs'
 * import { getProfile, createPost, subscribeRepos } from './lexicons'
 *
 * const router = new LexRouter({ upgradeWebSocket })
 *
 * // Register a query handler (GET request)
 * router.add(getProfile, async (ctx) => {
 *   const profile = await db.getProfile(ctx.params.actor)
 *   return { body: profile }
 * })
 *
 * // Register a procedure handler with authentication (POST request)
 * router.add(createPost, {
 *   handler: async (ctx) => {
 *     const post = await db.createPost(ctx.credentials.did, ctx.input.body)
 *     return { body: { uri: post.uri, cid: post.cid } }
 *   },
 *   auth: async ({ request }) => {
 *     return verifyAccessToken(request)
 *   }
 * })
 *
 * // Register a subscription handler (WebSocket)
 * router.add(subscribeRepos, async function* (ctx) {
 *   for await (const event of eventStream.since(ctx.params.cursor)) {
 *     if (ctx.signal.aborted) break
 *     yield event
 *   }
 * })
 *
 * // Start the server
 * const server = await serve(router, { port: 3000 })
 * console.log('XRPC server listening on port 3000')
 * ```
 *
 * @example Using with service authentication
 * ```typescript
 * import { LexRouter, serviceAuth } from '@atproto/lex-server'
 *
 * const router = new LexRouter()
 *
 * const auth = serviceAuth({
 *   audience: 'did:web:api.example.com',
 *   unique: async (nonce) => {
 *     // Check and record nonce uniqueness
 *     return await nonceStore.checkAndAdd(nonce)
 *   }
 * })
 *
 * router.add(protectedMethod, {
 *   handler: async (ctx) => {
 *     // ctx.credentials contains { did, didDocument, jwt }
 *     return { body: { callerDid: ctx.credentials.did } }
 *   },
 *   auth
 * })
 * ```
 */
export class LexRouter {
  /** Map of NSID strings to their fetch handlers. */
  readonly handlers: Map<NsidString, FetchHandler> = new Map()

  /**
   * Creates a new XRPC router.
   *
   * @param options - Router configuration options
   */
  constructor(readonly options: LexRouterOptions = {}) {}

  /**
   * Registers a subscription handler without authentication.
   *
   * @param ns - The Lexicon namespace definition for the subscription
   * @param handler - Async generator function that yields subscription messages
   * @returns This router instance for chaining
   */
  add<M extends Subscription>(
    ns: Main<M>,
    handler: LexRouterSubscriptionHandler<M, void>,
  ): this
  /**
   * Registers a subscription handler with authentication.
   *
   * @param ns - The Lexicon namespace definition for the subscription
   * @param config - Configuration object with handler and auth function
   * @returns This router instance for chaining
   */
  add<M extends Subscription, Credentials>(
    ns: Main<M>,
    config: LexRouterSubscriptionConfig<M, Credentials>,
  ): this
  /**
   * Registers a query or procedure handler without authentication.
   *
   * @param ns - The Lexicon namespace definition for the method
   * @param handler - Handler function that processes requests
   * @returns This router instance for chaining
   */
  add<M extends Query | Procedure>(
    ns: Main<M>,
    handler: LexRouterMethodHandler<M, void>,
  ): this
  /**
   * Registers a query or procedure handler with authentication.
   *
   * @param ns - The Lexicon namespace definition for the method
   * @param config - Configuration object with handler and auth function
   * @returns This router instance for chaining
   */
  add<M extends Query | Procedure, Credentials>(
    ns: Main<M>,
    config: LexRouterMethodConfig<M, Credentials>,
  ): this
  /**
   * Registers a Lexicon method handler.
   *
   * This is the unified overload that accepts any method type with optional authentication.
   *
   * @param ns - The Lexicon namespace definition
   * @param config - Handler function or configuration object
   * @returns This router instance for chaining
   *
   * @throws {TypeError} If a method with the same NSID is already registered
   *
   * @example
   * ```typescript
   * // Register without auth (credentials will be void)
   * router.add(myQuery, async (ctx) => {
   *   return { body: { data: 'value' } }
   * })
   *
   * // Register with auth
   * router.add(myProcedure, {
   *   handler: async (ctx) => {
   *     console.log('Caller:', ctx.credentials.userId)
   *     return { body: { success: true } }
   *   },
   *   auth: async ({ request }) => ({ userId: await verifyToken(request) })
   * })
   * ```
   */
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
        const params = method.parameters.fromURLSearchParams(
          url.searchParams,
        ) as InferMethodParams<Method>

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
            ) as InferMethodParams<Method>

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

  /**
   * The main fetch handler for processing XRPC requests.
   *
   * Routes incoming requests to the appropriate method handler based on the
   * NSID in the URL path. Returns appropriate error responses for invalid
   * paths or unimplemented methods.
   *
   * This handler can be used directly with HTTP servers that support the
   * fetch API pattern, or converted to a Node.js request listener using
   * `toRequestListener()`.
   *
   * @param request - The incoming HTTP request
   * @param connection - Optional connection metadata
   * @returns A promise resolving to the HTTP response
   *
   * @example
   * ```typescript
   * // Use with Deno
   * Deno.serve(router.fetch)
   *
   * // Use with Bun
   * Bun.serve({ fetch: router.fetch })
   *
   * // Use with Node.js
   * import { toRequestListener } from '@atproto/lex-server/nodejs'
   * const listener = toRequestListener(router.fetch)
   * http.createServer(listener).listen(3000)
   * ```
   */
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
