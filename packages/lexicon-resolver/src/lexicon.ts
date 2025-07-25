import dns from 'node:dns/promises'
import { CID } from 'multiformats/cid'
import { LexiconDoc, parseLexiconDoc } from '@atproto/lexicon'
import { Commit } from '@atproto/repo'
import { AtUri, NSID, ensureValidDid } from '@atproto/syntax'
import { ResolveRecordOptions, resolveRecord } from './record.js'
import { isValidDid } from './util.js'

const DNS_SUBDOMAIN = '_lexicon'
const DNS_PREFIX = 'did='
export const LEXICON_SCHEMA_NSID = 'com.atproto.lexicon.schema'

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

/**
 * Resolve a lexicon from the network, verifying its authenticity.
 * @param nsidStr NSID or string representing one for the Lexicon that will be resolved.
 * @param options
 * @returns
 */
export async function resolveLexicon(
  nsidStr: NSID | string,
  options: ResolveLexiconOptions = {},
): Promise<LexiconResolution> {
  const nsid = typeof nsidStr === 'string' ? NSID.parse(nsidStr) : nsidStr
  const didAuthority = await getDidAuthority(nsid, options)
  const verified = await resolveRecord(
    AtUri.make(didAuthority, LEXICON_SCHEMA_NSID, nsid.toString()),
    options,
  ).catch((err) => {
    throw new LexiconResolutionError(
      'Could not resolve lexicon schema record',
      { cause: err },
    )
  })
  let lexicon: LexiconDoc
  try {
    lexicon = parseLexiconDoc(verified.record)
  } catch (err) {
    throw new LexiconResolutionError('Invalid lexicon document', { cause: err })
  }
  if (!isLexiconSchemaRecord(lexicon)) {
    throw new LexiconResolutionError('Invalid lexicon schema record')
  }
  if (lexicon.id !== nsid.toString()) {
    throw new LexiconResolutionError(
      `Lexicon schema record id does not match NSID: ${lexicon.id}`,
    )
  }
  const { uri, cid, commit } = verified
  return { commit, uri, cid, nsid, lexicon }
}

/**
 *
 * @param nsidStr NSID or string representing one for which to lookup its lexicon DID authority.
 * @param options
 * @returns
 */
export async function resolveLexiconDidAuthority(nsidStr: NSID | string) {
  const nsid = typeof nsidStr === 'string' ? NSID.parse(nsidStr) : nsidStr
  const did = await resolveDns(nsid.authority)
  if (did == null || !isValidDid(did)) return
  return did
}

export class LexiconResolutionError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LexiconResolutionError'
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
      `Could not resolve a DID authority for NSID: ${nsid}`,
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
