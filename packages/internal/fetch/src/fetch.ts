export type GlobalFetchContext = void | null | typeof globalThis

// NOT using "typeof globalThis.fetch" here because "globalThis.fetch" does not
// have a "this" parameter, while runtimes do ensure that "fetch" is called with
// the correct "this" parameter (either null, undefined, or window).
export type GlobalFetch = (
  this: GlobalFetchContext,
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type Fetch =
  // - new line because of lint bug
  (this: GlobalFetchContext, input: Request) => Promise<Response>

export function toGlobalFetch(fetch: Fetch): GlobalFetch {
  return function (this: GlobalFetchContext, input, init) {
    return fetch.call(this, asRequest(input, init))
  }
}

export function asRequest(
  input: string | URL | Request,
  init?: RequestInit,
): Request {
  if (!init && input instanceof Request) return input
  return new Request(input, init)
}
