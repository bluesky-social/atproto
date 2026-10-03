import type { ThisParameterOverride } from './util.js'

export type FetchContext = void | null | typeof globalThis

// @NOTE Although the "globalThis.fetch" implementation **does** care about the
// "this" context, "lib.dom" and "@types/node" both omit the "this" parameter in
// their type definitions. This allows us to use "typeof globalThis.fetch" which
// makes dependents of this package get a type that match their environment.
export type FetchBound = typeof globalThis.fetch

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
