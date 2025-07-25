import dns from 'node:dns/promises'
import { CID } from 'multiformats/cid'
import { LexiconDoc, parseLexiconDoc } from '@atproto/lexicon'
import { Commit } from '@atproto/repo'
import { AtUri, NSID, ensureValidDid } from '@atproto/syntax'
import { ResolveRecordOptions, resolveRecord } from './record.js'

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
  let did: string | undefined
  if (options.didAuthority) {
    ensureValidDid(options.didAuthority)
    did = options.didAuthority
  } else {
    did = await getLexiconDidAuthority(nsid)
    if (!did) {
      throw new Error(`Could not resolve a DID authority for NSID: ${nsid}`)
    }
  }
  const verified = await resolveRecord(
    AtUri.make(did, LEXICON_SCHEMA_NSID, nsid.toString()),
    options,
  )
  const lexicon = parseLexiconDoc(verified.record)
  if (!isLexiconSchemaRecord(lexicon)) {
    throw new Error('Invalid lexicon schema record')
  }
  if (lexicon.id !== nsid.toString()) {
    throw new Error(
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
export async function getLexiconDidAuthority(nsidStr: NSID | string) {
  const nsid = typeof nsidStr === 'string' ? NSID.parse(nsidStr) : nsidStr
  const did = await resolveDns(nsid.authority)
  if (did == null || !isValidDid(did)) return
  return did
}

function isValidDid(did: string) {
  try {
    ensureValidDid(did)
    return true
  } catch {
    return false
  }
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
