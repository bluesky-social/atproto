import type { DidString } from '@atproto/lex-schema'
import { mergeHeaders } from './util.js'

/**
 * A function that performs HTTP requests towards a service endpoint.
 *
 * The handler is responsible for adding the origin (protocol, hostname, and
 * port) to the provided path, typically based on authentication or service
 * configuration. The handler can also be responsible for adding any necessary
 * headers, such as authorization tokens.
 *
 * @param path - The URL path (pathname + query parameters) without the origin
 * @param init - Standard fetch RequestInit options
 * @returns A Promise resolving to the HTTP Response
 */
export type FetchHandler = (
  /**
   * The URL (pathname + query parameters) to make the request to, without the
   * origin. The origin (protocol, hostname, and port) must be added by this
   * {@link FetchHandler}, typically based on authentication or other factors.
   */
  path: `/${string}`,
  init: RequestInit,
) => Promise<Response>

/**
 * The per-subscription options a {@link WebSocketHandler} receives.
 */
export type WebSocketHandlerOptions = {
  /**
   * Ends the stream when aborted, closing its connection. The iterator rejects
   * with the abort reason.
   */
  signal?: AbortSignal
  /**
   * Headers of the upgrade requests, taking precedence over the handler's own.
   */
  headers?: HeadersInit
}

/**
 * A function that opens a stream of binary WebSocket messages towards a
 * service endpoint, used for XRPC subscriptions. The WebSocket counterpart of
 * {@link FetchHandler}: the handler is responsible for adding the origin (with
 * a `ws(s)` protocol) to the provided path, and any connection configuration
 * (headers, liveness, …).
 *
 * The handler owns the connection lifecycle, and may reconnect (with a new
 * path) when a connection fails, so a stream can span several connections. A
 * frame that fails to decode or validate is handed back through the iterator's
 * `throw()`, when it implements one, so the handler can drop the connection
 * that delivered it and decide whether to reconnect, typically with
 * `isRetryableSubscriptionError()`.
 *
 * @throws {TransientError} if the connection fails and the error is classified as transient or not.
 * @see {@link AgentConfig.websocket} for building one with {@link buildAgent}.
 */
export type WebSocketHandler = (
  /**
   * Returns the URL (pathname + query parameters) to connect to, without the
   * origin. Must be invoked before every connection, reconnects included, since
   * the query parameters (e.g. a cursor) can change between connections.
   */
  path: () => Promise<`/${string}`>,
  options: WebSocketHandlerOptions,
) => AsyncIterable<Uint8Array<ArrayBuffer>>

/**
 * A function that opens a stream of binary WebSocket messages towards a URL:
 * the WebSocket counterpart of `fetch()`, from which {@link buildAgent} builds
 * a {@link WebSocketHandler}. `@atproto/lex-rpc/subscription` exports
 * `defaultWebsocket`, over `@atproto/ws-client` (whose `websocket()` is
 * compatible once set to binary frames), and `createWebSocketFactory()`, to
 * create one with other connection options.
 *
 * The (`ws:` or `wss:`) URL is given as a function, that must be invoked before
 * every connection (reconnects included), since its query parameters (e.g. a
 * cursor) can change between connections.
 *
 * @see {@link WebSocketHandler} for the expected behavior of the stream.
 */
export type WebSocketFactory = (
  url: () => Promise<URL>,
  options: WebSocketHandlerOptions,
) => AsyncIterable<Uint8Array<ArrayBuffer>>

/**
 * Core interface for making XRPC requests towards a specific service.
 *
 * An {@link Agent} encapsulates an identity and request handling for AT
 * Protocol operations. Agents will typically handle authentication, service URL
 * resolution, and other request configuration, allowing client code to make
 * requests without needing to manage these details directly. The key component
 * of an Agent is the {@link FetchHandler}, which is responsible for
 * constructing the full request URL and adding any necessary headers or
 * authentication tokens. The Agent's `did` property represents the
 * authenticated user's DID, if available, and can be used for operations that
 * require knowledge of the user's identity (such as creating AT Protocol
 * records).
 *
 * @see {@link buildAgent} for creating (simple) Agent instances.
 *
 * @example
 * ```typescript
 * const agent: Agent = {
 *   did: 'did:plc:example123',
 *   fetchHandler: async (path, init) => {
 *     const url = new URL(path, 'https://bsky.social')
 *     return fetch(url, init)
 *   }
 * }
 * ```
 */
export interface Agent {
  /** The DID of the authenticated user, or `undefined` if unauthenticated. */
  readonly did?: DidString
  /** The fetch handler used to make HTTP requests. */
  fetchHandler: FetchHandler
  /**
   * The WebSocket handler used to open XRPC subscriptions, if the agent
   * supports them.
   */
  websocketHandler?: WebSocketHandler
}

export interface AccountAgent extends Agent {
  /** The DID of the authenticated user. */
  readonly did: DidString
}

export function isAgent(value: unknown): value is Agent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetchHandler' in value &&
    typeof value.fetchHandler === 'function' &&
    (!('did' in value) ||
      value.did === undefined ||
      typeof value.did === 'string') &&
    (!('websocketHandler' in value) ||
      value.websocketHandler === undefined ||
      typeof value.websocketHandler === 'function')
  )
}

export function isAccountAgent(agent: Agent): agent is AccountAgent {
  return agent.did != null
}

export type AgentConfig = {
  /**
   * The identifier (DID) of the user represented by this agent.
   */
  did?: DidString

  /**
   * The service URL to make requests to. This can be a string, URL, or a
   * function that returns a string or URL. This is useful for dynamic URLs,
   * such as a service URL that changes based on authentication.
   */
  service: string | URL

  /**
   * Optional headers to include with every request made by this agent, unless
   * overridden by the request-specific headers provided to the fetch handler.
   */
  headers?: HeadersInit

  /**
   * Bring your own fetch implementation. Typically useful for testing, logging,
   * mocking, or adding retries, session management, signatures, proof of
   * possession (DPoP), SSRF protection, etc. Defaults to the global `fetch`
   * function.
   */
  fetch?: typeof globalThis.fetch

  /**
   * Enables XRPC subscriptions: the agent's {@link WebSocketHandler} connects
   * through this function, to the {@link AgentConfig.service service} (its
   * `http(s)` protocol mapped to `ws(s)`), with {@link AgentConfig.headers}
   * merged into the subscription's own.
   *
   * @example
   * ```typescript
   * import { defaultWebsocket } from '@atproto/lex-rpc/subscription'
   *
   * const agent = buildAgent({
   *   service: 'https://relay.example.com',
   *   websocket: defaultWebsocket,
   * })
   * ```
   *
   * @example With custom connection options
   * ```typescript
   * import { createWebSocketFactory } from '@atproto/lex-rpc/subscription'
   *
   * const agent = buildAgent({
   *   service: 'https://relay.example.com',
   *   websocket: createWebSocketFactory({ idleTimeoutMs: 60_000 }),
   * })
   * ```
   */
  websocket?: WebSocketFactory

  // Because this type get unioned with `Agent`, we need to prevent TypeScript
  // from accepting `headers` when `fetchHandler` is provided, since `headers`
  // would not be used (while the user might expect it to be).
  fetchHandler?: never
  websocketHandler?: never
}

/**
 * Options for creating an Agent.
 *
 * Can be a full {@link AgentConfig} object, or a simple service URL string/{@link URL}.
 */
export type AgentOptions = AgentConfig | FetchHandler | string | URL

/**
 * Creates an {@link Agent} from various input types.
 *
 * This factory function accepts an existing Agent (returned as-is), a service
 * URL, or a full configuration object. It handles the common case of creating
 * an unauthenticated agent from just a service URL.
 *
 * @param options - Agent instance, configuration object, or service URL
 * @returns A configured Agent ready for making requests
 * @throws {TypeError} If fetch() is not available in the environment
 *
 * @example // From URL string
 * ```typescript
 * const agent = buildAgent('https://public.api.bsky.app')
 * ```
 *
 * @example // From configuration
 * ```typescript
 * const agent = buildAgent({
 *   did: 'did:plc:example',
 *   service: 'https://bsky.social',
 *   headers: { 'Authorization': 'Bearer ...' }
 * })
 * ```
 *
 * @example // From existing Agent
 * ```typescript
 * const existingAgent: Agent = { ... }
 * const agent = buildAgent(existingAgent)
 * ```
 *
 * @example // From agent like object with fetchHandler
 * ```typescript
 * const agent = buildAgent({
 *   did: 'did:plc:example',
 *   fetchHandler: async (path, init) => { ... }
 *   // @NOTE "headers" and "service" are not allowed when providing a fetchHandler, because the input will returned "as is" if it matched the "Agent" interface.
 * })
 * ```
 */
export function buildAgent<O extends Agent | AgentOptions>(
  options: O,
): O extends Agent
  ? O
  : O extends AgentConfig & { did: DidString }
    ? AccountAgent
    : Agent
export function buildAgent(options: Agent | AgentOptions): Agent {
  if (typeof options === 'function') {
    return { did: undefined, fetchHandler: options }
  }

  const config: Agent | AgentConfig =
    typeof options === 'string' || options instanceof URL
      ? { did: undefined, service: options }
      : options

  // Prevent mismatch between `fetchHandler` and `headers` in the config, since
  // `headers` would be ignored if `fetchHandler` is provided.
  if ('fetchHandler' in config) {
    if (isAgent(config)) return config

    throw new TypeError(
      'fetchHandler must not be provided when using AgentConfig',
    )
  }

  const {
    did,
    service,
    fetch = globalThis.fetch,
    headers: defaultHeaders,
    websocket,
  } = config

  if (typeof fetch !== 'function') {
    throw new TypeError('fetch() is not available in this environment')
  }

  return {
    get did() {
      return did
    },

    async fetchHandler(path, init) {
      const headers =
        defaultHeaders != null && init.headers != null
          ? mergeHeaders(defaultHeaders, init.headers)
          : defaultHeaders || init.headers

      return fetch(
        new URL(path, service),
        headers !== init.headers ? { ...init, headers } : init,
      )
    },

    websocketHandler: websocket
      ? function (path, options) {
          const headers =
            defaultHeaders != null && options.headers != null
              ? mergeHeaders(defaultHeaders, options.headers)
              : defaultHeaders || options.headers

          return websocket(async () => toWebSocketUrl(await path(), service), {
            ...options,
            headers,
          })
        }
      : undefined,
  }
}

function toWebSocketUrl(path: `/${string}`, service: string | URL): URL {
  const url = new URL(path, service)
  switch (url.protocol) {
    case 'https:':
      url.protocol = 'wss:'
      return url
    case 'http:':
      url.protocol = 'ws:'
      return url
    case 'wss:':
    case 'ws:':
      return url
    default:
      throw new TypeError(
        `Unsupported protocol "${url.protocol}" for an XRPC subscription`,
      )
  }
}
