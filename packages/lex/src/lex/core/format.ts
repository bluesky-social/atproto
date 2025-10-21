import { CID } from 'multiformats/cid'
import {
  ensureValidAtUri,
  ensureValidDatetime,
  ensureValidDid,
  ensureValidHandle,
  ensureValidRecordKey,
  isValidTid,
  validateNsidRegex,
} from '@atproto/syntax'
import { ValidationContext, ValidationResult } from './validation.js'

export const STRING_FORMATS = Object.freeze([
  'datetime',
  'uri',
  'at-uri',
  'did',
  'handle',
  'at-identifier',
  'nsid',
  'cid',
  'language',
  'tid',
  'record-key',
] as const)

export type StringFormat = (typeof STRING_FORMATS)[number]

export type Did = `did:${string}:${string}`
export type Uri = `${string}://${string}`
/** An ISO 8601 formatted datetime string (YYYY-MM-DDTHH:mm:ss.sssZ) */
export type Datetime = `${string}T${string}Z`
export type Handle = `${string}.${string}`
export type AtIdentifier = Did | Handle
export type Nsid = `${string}.${string}.${string}`
export type AtUri = `at://${AtIdentifier}/${Nsid}/${string}`

export type InferStringFormat<F> =
  //
  F extends 'datetime'
    ? Datetime
    : F extends 'uri'
      ? Uri
      : F extends 'at-uri'
        ? AtUri
        : F extends 'did'
          ? Did
          : F extends 'handle'
            ? Handle
            : F extends 'at-identifier'
              ? AtIdentifier
              : F extends 'nsid'
                ? Nsid
                : string

export function validateStringFormat<F extends undefined | StringFormat>(
  input: string,
  ctx: ValidationContext,
  format: F,
): ValidationResult<InferStringFormat<F>>
export function validateStringFormat(
  input: string,
  ctx: ValidationContext,
  format: undefined | StringFormat,
): ValidationResult<string> {
  switch (format) {
    case undefined:
      return ctx.success(input)
    case 'datetime':
      return datetime(ctx, input)
    case 'uri':
      return uri(ctx, input)
    case 'at-uri':
      return atUri(ctx, input)
    case 'did':
      return did(ctx, input)
    case 'handle':
      return handle(ctx, input)
    case 'at-identifier':
      return atIdentifier(ctx, input)
    case 'nsid':
      return nsid(ctx, input)
    case 'cid':
      return cid(ctx, input)
    case 'language':
      return language(ctx, input)
    case 'tid':
      return tid(ctx, input)
    case 'record-key':
      return recordKey(ctx, input)
    default:
      throw new Error(`Unhandled string format (${format})`)
  }
}

export function coerceToString(
  input: unknown,
  format: undefined | StringFormat,
): string | null {
  switch (typeof input) {
    case 'string':
      return input
    case 'object':
      if (input === null) return null

      // Cast specific object types to matching format
      switch (format) {
        // @TODO AtUri ?
        case 'datetime':
          if (input instanceof Date) return input.toISOString()
          break
        case 'uri':
          if (input instanceof URL) return input.toString()
          break
        case 'cid': {
          const cid = CID.asCID(input)
          if (cid) return cid.toString()
          break
        }
      }

      // Also accept String objects
      if (input instanceof String) return input.valueOf()

    // falls through
    default:
      return null
  }
}

function datetime(
  ctx: ValidationContext,
  input: string,
): ValidationResult<Datetime> {
  try {
    ensureValidDatetime(input)
    return ctx.success(input as Datetime)
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined
    return ctx.issueInvalidFormat(input, 'datetime', message)
  }
}

function uri(ctx: ValidationContext, input: string): ValidationResult<Uri> {
  if (/^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input)) {
    return ctx.success(input as Uri)
  } else {
    return ctx.issueInvalidFormat(input, 'uri')
  }
}

function atUri(ctx: ValidationContext, input: string): ValidationResult<AtUri> {
  try {
    ensureValidAtUri(input)
    return ctx.success(input as AtUri)
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined
    return ctx.issueInvalidFormat(input, 'at-uri', message)
  }
}

function did(ctx: ValidationContext, input: string): ValidationResult<Did> {
  try {
    ensureValidDid(input)
    return ctx.success(input as Did)
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined
    return ctx.issueInvalidFormat(input, 'did', message)
  }
}

function handle(
  ctx: ValidationContext,
  input: string,
): ValidationResult<Handle> {
  try {
    ensureValidHandle(input)
    return ctx.success(input as Handle)
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined
    return ctx.issueInvalidFormat(input, 'handle', message)
  }
}

function atIdentifier(
  ctx: ValidationContext,
  input: string,
): ValidationResult<AtIdentifier> {
  // If the input starts with "did:", the user obviously intends it to be a DID,
  // so we should validate it as such and not try to validate it as a handle.
  if (input.startsWith('did:')) {
    return did(ctx, input)
  }

  // If the handle validation fails, the user might have meant to provide a DID
  // (but may have made a typo like "did:foo*:bar"). So we will not return the
  // handle validation error as its wording might be confusing in that case.
  const result = handle(ctx, input)
  if (result.success) return result

  return ctx.issueInvalidFormat(input, 'at-identifier', 'Invalid DID or handle')
}

function nsid(ctx: ValidationContext, input: string): ValidationResult<Nsid> {
  const result = validateNsidRegex(input)
  if (result.success) {
    return ctx.success(input as Nsid)
  } else {
    return ctx.issueInvalidFormat(input, 'nsid')
  }
}

function cid(ctx: ValidationContext, input: string): ValidationResult<string> {
  try {
    CID.parse(input)
    return ctx.success(input)
  } catch {
    return ctx.issueInvalidFormat(input, 'cid')
  }
}

// The language format validates well-formed BCP 47 language tags: https://www.rfc-editor.org/info/bcp47
function language(
  ctx: ValidationContext,
  input: string,
): ValidationResult<string> {
  if (isValidLanguage(input)) {
    return ctx.success(input)
  } else {
    return ctx.issueInvalidFormat(input, 'language')
  }
}

function tid(ctx: ValidationContext, input: string): ValidationResult<string> {
  if (isValidTid(input)) {
    return ctx.success(input)
  } else {
    return ctx.issueInvalidFormat(input, 'tid')
  }
}

function recordKey(
  ctx: ValidationContext,
  input: string,
): ValidationResult<string> {
  try {
    ensureValidRecordKey(input)
    return ctx.success(input)
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined
    return ctx.issueInvalidFormat(input, 'record-key', message)
  }
}

// @NOTE This was copied from @atproto/common-web to avoid loading a full extra
// dependency just for this regexp.

// Validates well-formed BCP 47 syntax: https://www.rfc-editor.org/rfc/rfc5646.html#section-2.1
const bcp47Regexp =
  /^((?<grandfathered>(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?<language>([A-Za-z]{2,3}(-(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?)|[A-Za-z]{4}|[A-Za-z]{5,8})(-(?<script>[A-Za-z]{4}))?(-(?<region>[A-Za-z]{2}|[0-9]{3}))?(-(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(-(?<extension>[0-9A-WY-Za-wy-z](-[A-Za-z0-9]{2,8})+))*(-(?<privateUseA>x(-[A-Za-z0-9]{1,8})+))?)|(?<privateUseB>x(-[A-Za-z0-9]{1,8})+))$/

function isValidLanguage(input: string): boolean {
  return bcp47Regexp.test(input)
}
