import dns from 'node:dns/promises'
import { Cid, l } from '@atproto/lex'
import { LexiconDocument, lexiconDocumentSchema } from '@atproto/lex-document'
import { Commit } from '@atproto/repo'
import { AtUri, NSID } from '@atproto/syntax'
import * as lexiconsSchema from './lexicons/com/atproto/lexicon/schema.js'
import {
  BuildRecordResolverOptions,
  ResolveRecordOptions,
  buildRecordResolver,
} from './record.js'

export { AtUri, NSID } from '@atproto/syntax'
export type { Commit } from '@atproto/repo'
export type { Cid, DidString, NsidString } from '@atproto/lex'
export type { LexiconDocument } from '@atproto/lex-document'

const DNS_SUBDOMAIN = '_lexicon'
const DNS_PREFIX = 'did='

export type LexiconDocumentRecord = lexiconsSchema.Main & LexiconDocument
export const LEXICON_SCHEMA_NSID = lexiconsSchema.$nsid

/**
 * Resolve Lexicon from an NSID
 */
export type LexiconResolver = (
  nsid: NSID | l.NsidString,
) => Promise<LexiconResolution>

/**
 * Resolve Lexicon from an NSID using Lexicon DID authority and record resolution
 */
export type AtprotoLexiconResolver = (
  nsid: NSID | l.NsidString,
  options?: ResolveLexiconOptions,
) => Promise<LexiconResolution>

export type BuildLexiconResolverOptions = BuildRecordResolverOptions

export type ResolveLexiconOptions = ResolveRecordOptions & {
  didAuthority?: l.DidString
}

export type LexiconResolution = {
  commit: Commit
  uri: AtUri
  cid: Cid
  nsid: NSID
  lexicon: LexiconDocumentRecord
}

/**
 * Build a Lexicon resolver function.
 */
export function buildLexiconResolver(
  options: BuildLexiconResolverOptions = {},
): AtprotoLexiconResolver {
  const resolveRecord = buildRecordResolver(options)
  return async function (
    input: NSID | l.NsidString,
    opts: ResolveLexiconOptions = {},
  ): Promise<LexiconResolution> {
    const nsid = NSID.from(input)
    const didAuthority = await getDidAuthority(nsid, opts)
    const verified = await resolveRecord(
      AtUri.make(didAuthority, lexiconsSchema.$nsid, nsid.toString()),
      { forceRefresh: opts.forceRefresh },
    ).catch((err) => {
      throw new LexiconResolutionError(
        nsid,
        'Could not resolve Lexicon schema record',
        { cause: err },
      )
    })

    if (!lexiconsSchema.$matches(verified.record)) {
      throw new LexiconResolutionError(nsid, 'Invalid Lexicon schema record')
    }

    const validationResult = lexiconDocumentSchema.safeValidate(verified.record)
    if (!validationResult.success) {
      throw new LexiconResolutionError(nsid, 'Invalid Lexicon document', {
        cause: validationResult.reason,
      })
    }

    const lexicon = validationResult.value
    if (lexicon.id !== nsid.toString()) {
      throw new LexiconResolutionError(
        nsid,
        `Lexicon schema record id (${lexicon.id}) does not match NSID`,
      )
    }
    const { uri, cid, commit } = verified
    return { commit, uri, cid, nsid, lexicon }
  } satisfies LexiconResolver
}

export const resolveLexicon = buildLexiconResolver()

/**
 * Resolve the DID authority for a Lexicon from the network using DNS, based on its NSID.
 * @param input NSID or string representing one for which to lookup its Lexicon DID authority.
 */
export async function resolveLexiconDidAuthority(
  input: NSID | l.NsidString,
): Promise<l.DidString | undefined> {
  const nsid = NSID.from(input)
  const did = await resolveDns(nsid.authority)
  if (did == null || !l.isDidString(did)) return
  return did
}

export class LexiconResolutionError extends Error {
  constructor(
    public readonly nsid: NSID,
    public readonly description = `Could not resolve Lexicon for NSID`,
    options?: ErrorOptions,
  ) {
    super(`${description} (${nsid})`, options)
    this.name = 'LexiconResolutionError'
  }

  static from(
    input: NSID | string,
    description?: string,
    options?: ErrorOptions,
  ): LexiconResolutionError {
    const nsid = NSID.from(input)
    return new LexiconResolutionError(nsid, description, options)
  }
}

async function getDidAuthority(nsid: NSID, options: ResolveLexiconOptions) {
  if (options.didAuthority) {
    return options.didAuthority
  }
  const did = await resolveLexiconDidAuthority(nsid)
  if (!did) {
    throw new LexiconResolutionError(
      nsid,
      `Could not resolve a DID authority for NSID`,
    )
  }
  return did
}

async function resolveDns(authority: string): Promise<string | undefined> {
  let chunkedResults: string[][]
  try {
    chunkedResults = await dns.resolveTxt(`${DNS_SUBDOMAIN}.${authority}`)
  } catch (err) {
    return undefined
  }
  return parseDnsResult(chunkedResults)
}

function parseDnsResult(chunkedResults: string[][]): string | undefined {
  const results = chunkedResults.map((chunks) => chunks.join(''))
  const found = results.filter((i) => i.startsWith(DNS_PREFIX))
  if (found.length !== 1) {
    return undefined
  }
  return found[0].slice(DNS_PREFIX.length)
}
