import * as lexiconSchema from './lexicons/com/atproto/lexicon/schema.js'
import * as getRecord from './lexicons/com/atproto/sync/getRecord.js'

/** Fetch local Lexicon proofs without connecting back through the public host. */
export function createLexiconFetch({
  publicUrl,
  getLocalRecord,
  fetch,
}: {
  publicUrl: string
  getLocalRecord: (params: getRecord.$Params) => Promise<Uint8Array>
  fetch: typeof globalThis.fetch
}): typeof globalThis.fetch {
  const origin = new URL(publicUrl).origin

  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method =
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    if (
      method.toUpperCase() !== 'GET' ||
      url.origin !== origin ||
      url.pathname !== `/xrpc/${getRecord.$lxm}` ||
      url.searchParams.get('collection') !== lexiconSchema.$nsid
    ) {
      return fetch(input, init)
    }

    const signal =
      init?.signal ?? (input instanceof Request ? input.signal : undefined)
    signal?.throwIfAborted()
    const params = getRecord.$params.fromURLSearchParams(url.searchParams)
    const bytes = await getLocalRecord(params)
    signal?.throwIfAborted()
    return new Response(new Uint8Array(bytes), {
      headers: { 'content-type': 'application/vnd.ipld.car' },
    })
  }
}
