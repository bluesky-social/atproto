import assert from 'node:assert'
import { IncomingMessage, OutgoingMessage } from 'node:http'
import { Duplex, Readable, pipeline } from 'node:stream'
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
  json,
  text,
} from 'express'
import { contentType } from 'mime-types'
import { MaxSizeChecker, createDecoders } from '@atproto/common'
import { l } from '@atproto/lex-schema'
import {
  LexXrpcBody,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription,
  Lexicons,
  jsonToLex,
} from '@atproto/lexicon'
import { ResponseType } from '@atproto/xrpc'
import {
  ErrorResult,
  InternalServerError,
  InvalidRequestError,
  XRPCError,
} from './errors'
import {
  Auth,
  Input,
  LexMethodInput,
  LexMethodOutput,
  LexMethodParams,
  Output,
  Params,
  RouteOptions,
  UndecodedParams,
  handlerSuccess,
} from './types'

export type ParamsVerifierInternal<P extends Params = Params> = (
  req: IncomingMessage | ExpressRequest,
) => P

export type AuthVerifierInternal<C, A extends Auth = Auth> = (
  ctx: C,
) => Promise<Exclude<A, ErrorResult>>

export type InputVerifierInternal<I extends Input = Input> = (
  req: ExpressRequest,
  res: ExpressResponse,
) => Promise<I>

export type OutputVerifierInternal<O extends Output = Output> = (
  handleOutput: Exclude<O, ErrorResult>,
) => void

export const asArray = <T>(arr: T | T[]): T[] =>
  Array.isArray(arr) ? arr : [arr]

export function setHeaders(
  res: OutgoingMessage,
  headers?: Record<string, string | number>,
) {
  if (headers) {
    for (const [name, val] of Object.entries(headers)) {
      if (val != null) res.setHeader(name, val)
    }
  }
}

function decodeQueryParams(
  def: LexXrpcProcedure | LexXrpcQuery | LexXrpcSubscription,
  params: UndecodedParams,
): Params {
  const decoded: Params = {}
  for (const k in params) {
    const val = params[k]
    const property = def.parameters?.properties?.[k]
    if (property) {
      if (property.type === 'array') {
        const vals: (typeof val)[] = []
        decoded[k] = val
          ? vals
              .concat(val) // Cast to array
              .flatMap((v) => decodeQueryParam(property.items.type, v) ?? [])
          : undefined
      } else {
        decoded[k] = decodeQueryParam(property.type, val)
      }
    }
  }
  return decoded
}

export function decodeQueryParam(
  type: string,
  value: unknown,
): string | number | boolean | undefined {
  if (!value) {
    return undefined
  }
  if (type === 'string' || type === 'datetime') {
    return String(value)
  }
  if (type === 'float') {
    return Number(String(value))
  } else if (type === 'integer') {
    return parseInt(String(value), 10) || 0
  } else if (type === 'boolean') {
    return value === 'true'
  }
}

export function getSearchParams(url?: string): URLSearchParams | undefined {
  if (!url) return undefined

  const queryStringIdx = url.indexOf('?')
  if (queryStringIdx === -1) return undefined

  const queryString = url.slice(queryStringIdx + 1)
  if (queryString.length === 0) return undefined

  return new URLSearchParams(queryString)
}

export function getQueryParams(
  req: IncomingMessage | ExpressRequest,
): UndecodedParams {
  if ('query' in req) return req.query

  const result: UndecodedParams = Object.create(null)

  const searchParams = getSearchParams(req.url)
  if (!searchParams) return result

  if (searchParams.has('__proto__')) {
    // Prevent prototype pollution
    throw new InvalidRequestError(
      `Invalid query parameter: __proto__`,
      'InvalidQueryParameter',
    )
  }

  for (const key of searchParams.keys()) {
    const values = searchParams.getAll(key)
    result[key] = values.length === 1 ? values[0] : values
  }

  return result
}

export function createLexiconParamsVerifier<P extends Params = Params>(
  nsid: string,
  def: LexXrpcQuery | LexXrpcProcedure | LexXrpcSubscription,
  lexicons: Lexicons,
): ParamsVerifierInternal<P> {
  return (req) => {
    try {
      const queryParams = getQueryParams(req)
      const params = decodeQueryParams(def, queryParams)
      return lexicons.assertValidXrpcParams(nsid, params) as P
    } catch (e) {
      throw new InvalidRequestError(String(e))
    }
  }
}

export function createSchemaParamsVerifier<
  M extends l.Procedure | l.Query | l.Subscription,
>(ns: l.Main<M>): ParamsVerifierInternal<LexMethodParams<M>> {
  const schema = l.getMain(ns)
  return (req) => {
    try {
      const queryParams = getQueryParams(req)
      return schema.parameters.parse(queryParams) as LexMethodParams<M>
    } catch (err) {
      throw new InvalidRequestError(String(err))
    }
  }
}

export function createLexiconInputVerifier<I extends Input = Input>(
  nsid: string,
  def: LexXrpcProcedure | LexXrpcQuery,
  options: RouteOptions,
  lexicons: Lexicons,
): InputVerifierInternal<I> {
  if (def.type === 'query' || !def.input) {
    return async (req) => {
      // @NOTE We allow (and ignore) "empty" bodies
      if (getBodyPresence(req) === 'present') {
        throw new InvalidRequestError(
          `A request body was provided when none was expected`,
        )
      }

      return undefined as I
    }
  }

  // Lexicon definition expects a request body

  const { input } = def
  const { blobLimit } = options

  const allowedEncodings = parseDefEncoding(input)
  const checkEncoding = allowedEncodings.includes(ENCODING_ANY)
    ? undefined // No need to check
    : (encoding: string) => allowedEncodings.includes(encoding)

  const bodyParser = createBodyParser(input.encoding, options)

  return async (req, res) => {
    if (getBodyPresence(req) === 'missing') {
      throw new InvalidRequestError(
        `A request body is expected but none was provided`,
      )
    }

    const reqEncoding = parseReqEncoding(req)
    if (checkEncoding && !checkEncoding(reqEncoding)) {
      throw new InvalidRequestError(
        `Wrong request encoding (Content-Type): ${reqEncoding}`,
      )
    }

    if (bodyParser) {
      await bodyParser(req, res)
    }

    if (input.schema) {
      try {
        const lexBody = req.body ? jsonToLex(req.body) : req.body
        req.body = lexicons.assertValidXrpcInput(nsid, lexBody)
      } catch (cause) {
        throw new InvalidRequestError(
          cause instanceof Error ? cause.message : String(cause),
          undefined,
          { cause },
        )
      }
    }

    // if middleware already got the body, we pass that along as input
    // otherwise, we pass along a decoded readable stream
    const body = req.readableEnded ? req.body : decodeBodyStream(req, blobLimit)

    return { encoding: reqEncoding, body } as I
  }
}

export function createSchemaInputVerifier<M extends l.Procedure | l.Query>(
  ns: l.Main<M>,
  options: RouteOptions,
): InputVerifierInternal<LexMethodInput<M>> {
  const schema = l.getMain(ns)
  const { blobLimit } = options

  const input: l.Payload | undefined =
    'input' in schema ? schema.input : undefined

  if (!input?.encoding) {
    //
    return async (req) => {
      if (getBodyPresence(req) === 'present') {
        throw new InvalidRequestError(
          `A request body was provided when none was expected`,
        )
      }

      return undefined as LexMethodInput<M>
    }
  }

  const bodyParser = createBodyParser(input.encoding, options)

  return async (req, res) => {
    if (getBodyPresence(req) === 'missing') {
      throw new InvalidRequestError(
        `A request body is expected but none was provided`,
      )
    }

    const reqEncoding = parseReqEncoding(req)
    if (!input.matchesEncoding(reqEncoding)) {
      throw new InvalidRequestError(
        `Wrong request encoding (Content-Type): ${reqEncoding}`,
      )
    }

    if (bodyParser) {
      await bodyParser(req, res)
    }

    if (input.schema) {
      try {
        req.body = input.schema.parse({
          encoding: reqEncoding,
          body: req.body ? jsonToLex(req.body) : req.body,
        })
      } catch (cause) {
        throw new InvalidRequestError(
          cause instanceof Error ? cause.message : String(cause),
          undefined,
          { cause },
        )
      }
    }

    // if middleware already got the body, we pass that along as input
    // otherwise, we pass along a decoded readable stream
    const body = req.readableEnded ? req.body : decodeBodyStream(req, blobLimit)

    return { encoding: reqEncoding, body } as LexMethodInput<M>
  }
}

export function createLexiconOutputVerifier<O extends Output = Output>(
  nsid: string,
  def: LexXrpcProcedure | LexXrpcQuery,
  lexicons: Lexicons,
): OutputVerifierInternal<O> {
  const outputDef = def.output

  // Expects no output
  if (!outputDef) {
    return (handlerOutput) => {
      if (handlerOutput !== undefined) {
        throw new InternalServerError(
          `A response body was provided when none was expected`,
        )
      }
    }
  }

  // An output is expected
  return (handlerOutput) => {
    if (handlerOutput === undefined) {
      throw new InternalServerError(
        `A response body is expected but none was provided`,
      )
    }

    // Fool-proofing (should not be necessary due to type system)
    const result = handlerSuccess.safeParse(handlerOutput)
    if (!result.success) {
      throw new InternalServerError(`Invalid handler output`, undefined, {
        cause: result.error,
      })
    }

    // output mime
    const { encoding } = handlerOutput
    if (!isValidEncoding(outputDef, encoding)) {
      throw new InternalServerError(`Invalid response encoding: ${encoding}`)
    }

    // output schema
    try {
      const result = lexicons.assertValidXrpcOutput(nsid, handlerOutput.body)
      // @TODO Since the output verifier is typically enabled in dev/tests and
      // disabled in production, we don't want to assign the (altered) output
      // back to the handlerOutput object, as this would cause different
      // behaviors between environments. Instead, we should compare the result
      // with the original output and throw if they differ (indicating that the
      // output was mutated during validation, e.g. due to default values).
      result
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Output body validation failed'
      throw new InternalServerError(message, undefined, { cause })
    }
  }
}

export function createSchemaOutputVerifier<M extends l.Procedure | l.Query>(
  ns: l.Main<M>,
): OutputVerifierInternal<LexMethodOutput<M>> {
  const outputSchema = l.getMain(ns).output
  return (handlerOutput) => {
    if (!outputSchema.matchesEncoding(handlerOutput?.encoding)) {
      throw new InternalServerError('Output encoding mismatch')
    }
    if (outputSchema.schema) {
      const result = outputSchema.schema.safeValidate(handlerOutput?.body)
      if (!result.success) {
        throw new InternalServerError(result.reason.message, undefined, {
          cause: result.reason,
        })
      }
    } else if (!outputSchema.encoding && handlerOutput?.body !== undefined) {
      throw new InternalServerError('Output body not expected')
    }
  }
}

export function parseReqEncoding(req: IncomingMessage): string {
  const encoding = normalizeMime(req.headers['content-type'])
  if (encoding) return encoding
  throw new InvalidRequestError(
    `Request encoding (Content-Type) required but not provided`,
  )
}

function normalizeMime(v?: string): string | null {
  if (!v) return null
  const fullType = contentType(v)
  if (!fullType) return null
  const shortType = fullType.split(';')[0]
  if (!shortType) return null
  return shortType
}

const ENCODING_ANY = '*/*'

function parseDefEncoding({ encoding }: LexXrpcBody) {
  return encoding.split(',').map(trimString)
}

function trimString(str: string): string {
  return str.trim()
}

function isValidEncoding(output: LexXrpcBody, encoding?: string) {
  if (!encoding) return false

  const normalized = normalizeMime(encoding)
  if (!normalized) return false

  const allowed = parseDefEncoding(output)
  if (!allowed.length) return false

  return (
    allowed.includes(ENCODING_ANY) ||
    allowed.includes(normalized) ||
    allowed.includes(`${normalized.split('/', 1)[0]}/*`)
  )
}

type BodyPresence = 'missing' | 'empty' | 'present'

function getBodyPresence(req: IncomingMessage): BodyPresence {
  if (req.headers['transfer-encoding'] != null) return 'present'
  if (req.headers['content-length'] === '0') return 'empty'
  if (req.headers['content-length'] != null) return 'present'
  return 'missing'
}

function createBodyParser(inputEncoding: string, options: RouteOptions) {
  if (inputEncoding === ENCODING_ANY) {
    // When the lexicon's input encoding is */*, the handler will determine how to process it
    return
  }
  const { jsonLimit, textLimit } = options
  const jsonParser = json({ limit: jsonLimit })
  const textParser = text({ limit: textLimit })
  // Transform json and text parser middlewares into a single function
  return (req: ExpressRequest, res: ExpressResponse) => {
    return new Promise<void>((resolve, reject) => {
      jsonParser(req, res, (err) => {
        if (err) return reject(XRPCError.fromError(err))
        textParser(req, res, (err) => {
          if (err) return reject(XRPCError.fromError(err))
          resolve()
        })
      })
    })
  }
}

function decodeBodyStream(
  req: IncomingMessage,
  maxSize: number | undefined,
): Readable {
  const contentEncoding = req.headers['content-encoding']
  const contentLength = req.headers['content-length']

  const contentLengthParsed = contentLength
    ? parseInt(contentLength, 10)
    : undefined

  if (Number.isNaN(contentLengthParsed)) {
    throw new XRPCError(ResponseType.InvalidRequest, 'invalid content-length')
  }

  if (
    maxSize !== undefined &&
    contentLengthParsed !== undefined &&
    contentLengthParsed > maxSize
  ) {
    throw new XRPCError(
      ResponseType.PayloadTooLarge,
      'request entity too large',
    )
  }

  let transforms: Duplex[]
  try {
    transforms = createDecoders(contentEncoding)
  } catch (cause) {
    throw new XRPCError(
      ResponseType.UnsupportedMediaType,
      'unsupported content-encoding',
      undefined,
      { cause },
    )
  }

  if (maxSize !== undefined) {
    const maxSizeChecker = new MaxSizeChecker(
      maxSize,
      () =>
        new XRPCError(ResponseType.PayloadTooLarge, 'request entity too large'),
    )
    transforms.push(maxSizeChecker)
  }

  return transforms.length > 0
    ? (pipeline([req, ...transforms], () => {}) as Duplex)
    : req
}

export function serverTimingHeader(timings: ServerTiming[]) {
  return timings
    .map((timing) => {
      let header = timing.name
      if (timing.duration) header += `;dur=${timing.duration}`
      if (timing.description) header += `;desc="${timing.description}"`
      return header
    })
    .join(', ')
}

export class ServerTimer implements ServerTiming {
  public duration?: number
  private startMs?: number
  constructor(
    public name: string,
    public description?: string,
  ) {}
  start() {
    this.startMs = Date.now()
    return this
  }
  stop() {
    assert(this.startMs, "timer hasn't been started")
    this.duration = Date.now() - this.startMs
    return this
  }
}

export interface ServerTiming {
  name: string
  duration?: number
  description?: string
}

export const parseReqNsid = (req: ExpressRequest | IncomingMessage) =>
  parseUrlNsid('originalUrl' in req ? req.originalUrl : req.url || '/')

/**
 * Validates and extracts the nsid from an xrpc path
 */
export const parseUrlNsid = (url: string): string => {
  const nsid = extractUrlNsid(url)
  if (nsid) return nsid
  throw new InvalidRequestError('invalid xrpc path')
}

export const extractUrlNsid = (url: string): string | undefined => {
  // /!\ Hot path

  if (
    // Ordered by likelihood of failure
    url.length <= 6 ||
    url[5] !== '/' ||
    url[4] !== 'c' ||
    url[3] !== 'p' ||
    url[2] !== 'r' ||
    url[1] !== 'x' ||
    url[0] !== '/'
  ) {
    return undefined
  }

  const startOfNsid = 6

  let curr = startOfNsid
  let char: number
  let alphaNumRequired = true
  for (; curr < url.length; curr++) {
    char = url.charCodeAt(curr)
    if (
      (char >= 48 && char <= 57) || // 0-9
      (char >= 65 && char <= 90) || // A-Z
      (char >= 97 && char <= 122) // a-z
    ) {
      alphaNumRequired = false
    } else if (char === 45 /* "-" */ || char === 46 /* "." */) {
      if (alphaNumRequired) {
        return undefined
      }
      alphaNumRequired = true
    } else if (char === 47 /* "/" */) {
      // Allow trailing slash (next char is either EOS or "?")
      if (curr === url.length - 1 || url.charCodeAt(curr + 1) === 63) {
        break
      }
      return undefined
    } else if (char === 63 /* "?"" */) {
      break
    } else {
      return undefined
    }
  }

  // last char was one of: '-', '.', '/'
  if (alphaNumRequired) {
    return undefined
  }

  // A domain name consists of minimum two characters
  if (curr - startOfNsid < 2) {
    return undefined
  }

  // @TODO check max length of nsid

  return url.slice(startOfNsid, curr)
}
