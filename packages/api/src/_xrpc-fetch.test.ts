import { vi } from 'vitest'
import { Agent } from './agent.js'

export type XrpcCall = {
  url: URL
  params: URLSearchParams
  headers: Headers
  body: unknown
}

export type XrpcHandler = (call: XrpcCall) => unknown

/**
 * A `fetch` that answers each XRPC method with its entry in `handlers`: a
 * returned `Response` is sent as is, `undefined` as an empty 200 and any other
 * value as a JSON body. Other methods get a 501.
 */
export function xrpcFetch(handlers: Record<string, XrpcHandler>) {
  return vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const nsid = url.pathname.replace(/^\/xrpc\//, '')
    if (!Object.hasOwn(handlers, nsid)) {
      return xrpcError(501, 'MethodNotImplemented')
    }
    const text = await request.text()
    const result = await handlers[nsid]({
      url,
      params: url.searchParams,
      headers: request.headers,
      body: text ? JSON.parse(text) : undefined,
    })
    if (result instanceof Response) return result
    return result === undefined ? new Response(null) : Response.json(result)
  })
}

export function xrpcError(status: number, error: string, message?: string) {
  return Response.json({ error, message }, { status })
}

export const DID = 'did:plc:alice'

/**
 * An {@link Agent} authenticated as {@link DID} that sends its requests to
 * `fetch`.
 */
export function createAgent(fetch: typeof globalThis.fetch): Agent {
  return new Agent({
    did: DID,
    fetchHandler: (url, init) => fetch(new URL(url, 'https://pds.test'), init),
  })
}

/**
 * An {@link Agent} whose server only holds preferences: `getPreferences`
 * returns what `putPreferences` last stored, starting from `preferences`.
 */
export function preferencesStore(preferences: unknown[] = []) {
  const store: { preferences: unknown[]; agent: Agent } = {
    preferences,
    agent: createAgent(
      xrpcFetch({
        'app.bsky.actor.getPreferences': () => ({
          preferences: store.preferences,
        }),
        'app.bsky.actor.putPreferences': ({ body }) => {
          store.preferences = (body as { preferences: unknown[] }).preferences
        },
      }),
    ),
  }
  return store
}
