import { parse as parseJson } from '@hapi/bourne'
import { type as hapiContentType } from '@hapi/content'
import createHttpError from 'http-errors'

export type JsonScalar = string | number | boolean | null
export type Json = JsonScalar | Json[] | { [_ in string]?: Json }

export const parseContentType = (type: string): ContentType => {
  try {
    return hapiContentType(type)
  } catch (err) {
    // De-boomify the error
    if (err?.['isBoom']) {
      throw createHttpError(err['output']['statusCode'], err['message'])
    }

    throw err
  }
}

export type ContentType = {
  mime: string
  charset?: string
  boundary?: string
}

export type Parser<T extends string = string, R = unknown> = {
  readonly name: string
  readonly test: (mime: string) => mime is T
  readonly parse: (buffer: Buffer, type: ContentType) => R
}

export type ParserName<P extends Parser> = P extends { readonly name: infer N }
  ? N
  : never
export type ParserType<P extends Parser> = P extends Parser<infer T> ? T : never
export type ParserResult<P extends Parser> = ReturnType<P['parse']>

export type ParserForType<P extends Parser, T> =
  P extends Parser<infer U> ? (U extends T ? P : never) : never

export const parsers = [
  {
    name: 'json',
    test: (mime): mime is `application/json` | `application/${string}+json` => {
      return /^application\/(?:.+\+)?json$/.test(mime)
    },
    parse: (buffer, { charset }): Json => {
      if (charset != null && !/^utf-?8$/i.test(charset)) {
        throw createHttpError(415, 'Unsupported charset')
      }
      try {
        return parseJson(buffer.toString())
      } catch (err) {
        throw createHttpError(400, 'Invalid JSON', { cause: err })
      }
    },
  },
  {
    name: 'urlencoded',
    test: (mime): mime is 'application/x-www-form-urlencoded' => {
      return mime === 'application/x-www-form-urlencoded'
    },
    parse: (buffer, { charset }): Partial<Record<string, string>> => {
      if (charset != null && !/^utf-?8$/i.test(charset)) {
        throw createHttpError(415, 'Unsupported charset')
      }
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
    test: (mime): mime is 'application/octet-stream' => {
      return mime === 'application/octet-stream'
    },
    parse: (buffer): Buffer => buffer,
  },
] as const satisfies Parser[]

export type KnownParser = (typeof parsers)[number]

export type KnownNames = KnownParser['name']
export type KnownTypes = ParserType<KnownParser>
