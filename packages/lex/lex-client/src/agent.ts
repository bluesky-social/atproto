import { DidString } from '@atproto/lex-schema'

export type FetchHandler = (
  /**
   * The URL (pathname + query parameters) to make the request to, without the
   * origin. The origin (protocol, hostname, and port) must be added by this
   * {@link FetchHandler}, typically based on authentication or other factors.
   */
  path: string,
  init: RequestInit,
) => Promise<Response>

export interface Agent {
  readonly did?: DidString
  fetchHandler: FetchHandler
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
   * Bring your own fetch implementation. Typically useful for testing, logging,
   * mocking, or adding retries, session management, signatures, proof of
   * possession (DPoP), SSRF protection, etc. Defaults to the global `fetch`
   * function.
   */
  fetch?: typeof globalThis.fetch
}

export type AgentOptions = AgentConfig | string | URL

export function buildAgent(options: Agent | AgentOptions): Agent {
  if (typeof options === 'object' && 'fetchHandler' in options) {
    return options
  }

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
      return fetch(new URL(path, service), init)
    },
  }
}
