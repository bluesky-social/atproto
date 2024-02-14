import { parse as parseJson } from '@hapi/bourne'
import createHttpError from 'http-errors'

export type JsonScalar = string | number | boolean | null
export type Json = JsonScalar | Json[] | { [_ in string]?: Json }

export type Parser<T = unknown, R = unknown> = {
  readonly name: string
  readonly test: (type: unknown) => type is T
  readonly parse: (buffer: Buffer) => R
}

export type ParserName<P extends Parser> = P extends { readonly name: infer N }
  ? N
  : never
export type ParserType<P extends Parser> = P extends Parser<infer T> ? T : never
export type ParserResult<P extends Parser> =
  P extends Parser<any, infer R> ? R : never

export type ParserForType<P extends Parser, T> =
  P extends Parser<infer U> ? (U extends T ? P : never) : never

export const parsers = [
  {
    name: 'json',
    test: (
      type: unknown,
    ): type is `application/json` | `application/${string}+json` => {
      return (
        typeof type === 'string' && /^application\/(?:.+\+)?json$/.test(type)
      )
    },
    parse: (buffer: Buffer): Json => {
      try {
        return parseJson(buffer.toString())
      } catch (err) {
        throw createHttpError(400, 'Invalid JSON', { cause: err })
      }
    },
  },
  {
    name: 'urlencoded',
    test: (type: unknown): type is 'application/x-www-form-urlencoded' => {
      return type === 'application/x-www-form-urlencoded'
    },
    parse: (buffer: Buffer): Partial<Record<string, string>> => {
      try {
        if (!buffer.length) return {}
        return Object.fromEntries(new URLSearchParams(buffer.toString()))
      } catch (err) {
        throw createHttpError(400, 'Invalid URL-encoded data', { cause: err })
      }
    },
  },
  {
    name: 'bytes',
    test: (type: unknown): type is 'application/octet-stream' => {
      return type === 'application/octet-stream'
    },
    parse: (buffer: Buffer): Buffer | null => (buffer.length ? buffer : null),
  },
] as const

export type KnownParser = (typeof parsers)[number]

export type KnownNames = KnownParser['name']
export type KnownTypes = ParserType<KnownParser>

export type TypeToParserMap<P extends KnownParser = KnownParser> = {
  [T in ParserType<P>]: ParserResult<ParserForType<P, T>>
}
