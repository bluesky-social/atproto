import { DidString } from '@atproto/lex-schema'

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
}

export function isAgent(value: unknown): value is Agent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetchHandler' in value &&
    typeof value.fetchHandler === 'function' &&
    (!('did' in value) ||
      value.did === undefined ||
      typeof value.did === 'string')
  )
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
}

/**
 * Options for creating an Agent.
 *
 * Can be a full {@link AgentConfig} object, or a simple service URL string/{@link URL}.
 */
export type AgentOptions = AgentConfig | string | URL

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
 */
export function buildAgent<O extends Agent | AgentOptions>(
  options: O,
): O extends Agent ? O : Agent
export function buildAgent(options: Agent | AgentOptions): Agent {
  if (isAgent(options)) return options

  const config: Agent | AgentConfig =
    typeof options === 'string' || options instanceof URL
      ? { did: undefined, service: options }
      : options

  const { service, fetch = globalThis.fetch } = config

  if (typeof fetch !== 'function') {
    throw new TypeError('fetch() is not available in this environment')
  }

  return {
    get did() {
      return config.did
    },

    async fetchHandler(path, init) {
      const headers =
        config.headers != null && init.headers != null
          ? mergeHeaders(config.headers, init.headers)
          : config.headers || init.headers

      return fetch(
        new URL(path, service),
        headers !== init.headers ? { ...init, headers } : init,
      )
    },
  }
}

function mergeHeaders(
  defaultHeaders: HeadersInit,
  requestHeaders: HeadersInit,
): Headers {
  // We don't want to alter the original Headers objects, so we create a new one
  const result = new Headers(defaultHeaders)

  const overrides =
    requestHeaders instanceof Headers
      ? requestHeaders
      : new Headers(requestHeaders)

  for (const [key, value] of overrides.entries()) {
    result.set(key, value)
  }

  return result
}
