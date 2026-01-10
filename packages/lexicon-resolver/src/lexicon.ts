import dns from 'node:dns/promises'
import { CID } from 'multiformats/cid'
import { LexiconDoc, parseLexiconDoc } from '@atproto/lexicon'
import { Commit } from '@atproto/repo'
import { AtUri, NSID, ensureValidDid } from '@atproto/syntax'
import {
  BuildRecordResolverOptions,
  ResolveRecordOptions,
  buildRecordResolver,
} from './record.js'
import { isValidDid } from './util.js'

const DNS_SUBDOMAIN = '_lexicon'
const DNS_PREFIX = 'did='
export const LEXICON_SCHEMA_NSID = 'com.atproto.lexicon.schema'

/**
 * Resolve Lexicon from an NSID
 */
export type LexiconResolver = (
  nsid: NSID | string,
) => Promise<LexiconResolution>

/**
 * Resolve Lexicon from an NSID using Lexicon DID authority and record resolution
 */
export type AtprotoLexiconResolver = (
  nsid: NSID | string,
  options?: ResolveLexiconOptions,
) => Promise<LexiconResolution>

export type BuildLexiconResolverOptions = BuildRecordResolverOptions

export type ResolveLexiconOptions = ResolveRecordOptions & {
  didAuthority?: string
}

export type LexiconResolution = {
  commit: Commit
  uri: AtUri
  cid: CID
  nsid: NSID
  lexicon: LexiconDoc & LexiconSchemaRecord
}

export {
  AtUri,
  CID,
  type Commit,
  type LexiconDoc,
  type LexiconSchemaRecord,
  NSID,
}

/**
 * Build a Lexicon resolver function.
 */
export function buildLexiconResolver(
  options: BuildLexiconResolverOptions = {},
): AtprotoLexiconResolver {
  const resolveRecord = buildRecordResolver(options)
  return async function (
    input: NSID | string,
    opts: ResolveLexiconOptions = {},
  ): Promise<LexiconResolution> {
    const nsid = NSID.from(input)
    const didAuthority = await getDidAuthority(nsid, opts)
    const verified = await resolveRecord(
      AtUri.make(didAuthority, LEXICON_SCHEMA_NSID, nsid.toString()),
      { forceRefresh: opts.forceRefresh },
    ).catch((err) => {
      throw new LexiconResolutionError(
        nsid,
        'Could not resolve Lexicon schema record',
        { cause: err },
      )
    })
    let lexicon: LexiconDoc
    try {
      lexicon = parseLexiconDoc(verified.record)
    } catch (err) {
      throw new LexiconResolutionError(nsid, 'Invalid Lexicon document', {
        cause: err,
      })
    }
    if (!isLexiconSchemaRecord(lexicon)) {
      throw new LexiconResolutionError(nsid, 'Invalid Lexicon schema record')
    }
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
  input: NSID | string,
): Promise<string | undefined> {
  const nsid = NSID.from(input)
  const did = await resolveDns(nsid.authority)
  if (did == null || !isValidDid(did)) return
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
    ensureValidDid(options.didAuthority)
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

type LexiconSchemaRecord = { $type: typeof LEXICON_SCHEMA_NSID }
function isLexiconSchemaRecord(v: unknown): v is LexiconSchemaRecord {
  return v?.['$type'] === LEXICON_SCHEMA_NSID
}
