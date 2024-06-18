import { ThisParameterOverride } from './util.js'

export type FetchContext = void | null | typeof globalThis

export type FetchBound = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

// NOT using "typeof globalThis.fetch" here because "globalThis.fetch" does not
// have a "this" parameter, while runtimes do ensure that "fetch" is called with
// the correct "this" parameter (either null, undefined, or window).

export type Fetch<C = FetchContext> = ThisParameterOverride<C, FetchBound>

export type SimpleFetchBound = (input: Request) => Promise<Response>
export type SimpleFetch<C = FetchContext> = ThisParameterOverride<
  C,
  SimpleFetchBound
>

export function toRequestTransformer<C, O>(
  requestTransformer: (this: C, input: Request) => O,
): ThisParameterOverride<
  C,
  (input: string | URL | Request, init?: RequestInit) => O
> {
  return function (this: C, input, init) {
    return requestTransformer.call(this, asRequest(input, init))
  }
}

export function asRequest(
  input: string | URL | Request,
  init?: RequestInit,
): Request {
  if (!init && input instanceof Request) return input
  return new Request(input, init)
}
