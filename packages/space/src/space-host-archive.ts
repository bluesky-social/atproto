import { type LexValue, decode, encode } from '@atproto/lex-cbor'
import { type LexMap, isPlainObject } from '@atproto/lex-data'
import {
  type DidString,
  type SpaceRefString,
  isValidDid,
} from '@atproto/syntax'
import { compareBytes, utf8 } from './bytes.js'
import { SpaceHostArchiveError } from './error.js'
import { type StarPair, readStar, writeStar } from './star.js'
import {
  type Def,
  SPACE_HOST_STAR_TYPE,
  SPACE_HOST_VERSION,
  type SpaceHostStarMeta,
  defs,
} from './types.js'

/**
 * A space authority's host-side state for one space, carried between hosts when
 * the authority's account migrates.
 *
 * Serialized as a STAR archive with the `atproto-space-host` profile. After the
 * metadata come three sections, in this order, each in strict key order:
 *
 * 1. `policy`: the space's policy object.
 * 2. Policy state: anything else the policy keeps (e.g. a member list), keyed
 *    like record paths (`{nsid}/{rkey}`), with values the policy defines.
 * 3. `writer/{did}`: one entry per repo in the writer set.
 */
export type SpaceHostArchive = {
  space: SpaceRefString
  policy: LexMap
  policyState: PolicyStateEntry[]
  writers: SpaceHostWriter[]
}

export type PolicyStateEntry = {
  key: string
  value: LexMap
}

export type SpaceHostWriter = {
  did: DidString
  rev: string
  data: Uint8Array
  spaceRev: string
}

const POLICY_KEY = 'policy'
const WRITER_KEY_PREFIX = 'writer/'

const SECTIONS = ['policy', 'policyState', 'writers'] as const
type Section = (typeof SECTIONS)[number]

/** Serialize a space host archive, putting each section into key order. */
export async function* serializeSpaceHost(
  archive: SpaceHostArchive,
): AsyncGenerator<Uint8Array> {
  const meta: SpaceHostStarMeta = {
    $type: SPACE_HOST_STAR_TYPE,
    ver: SPACE_HOST_VERSION,
    space: archive.space,
  }
  const policyState = archive.policyState.map(({ key, value }) =>
    toPair(key, value),
  )
  const writers = archive.writers.map(({ did, ...writer }) =>
    toPair(`${WRITER_KEY_PREFIX}${did}`, writer),
  )
  yield* writeStar(meta, [
    toPair(POLICY_KEY, archive.policy),
    ...sortByKey(policyState),
    ...sortByKey(writers),
  ])
}

/**
 * Read a space host archive, rejecting it if a section is missing or out of
 * place, or a key is duplicated or out of order. Read whole, since it holds a
 * space's configuration and writer set rather than its records.
 */
export async function readSpaceHostStar(
  star: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): Promise<SpaceHostArchive> {
  await using reader = await readStar(star)
  const meta = parseDef(defs.spaceHostStarMeta, reader.meta)

  let policy: LexMap | undefined
  const policyState: PolicyStateEntry[] = []
  const writers: SpaceHostWriter[] = []

  const decoder = new TextDecoder()
  let section: Section | undefined
  let prevKey: Uint8Array | undefined
  for await (const pair of reader.pairs) {
    const key = decoder.decode(pair.key)

    const keySection = sectionOf(key)
    if (keySection !== section) {
      if (section && SECTIONS.indexOf(keySection) < SECTIONS.indexOf(section)) {
        throw new SpaceHostArchiveError(`section out of order at ${key}`)
      }
      section = keySection
      prevKey = undefined
    }
    if (prevKey && compareBytes(pair.key, prevKey) <= 0) {
      throw new SpaceHostArchiveError(`duplicate or out-of-order key: ${key}`)
    }
    prevKey = pair.key

    const value = decodeMap(key, pair.value)
    switch (keySection) {
      case 'policy':
        policy = value
        break
      case 'policyState':
        policyState.push({ key, value })
        break
      case 'writers':
        writers.push(parseWriter(key, value))
        break
    }
  }

  if (!policy) {
    throw new SpaceHostArchiveError('missing policy')
  }
  return { space: meta.space, policy, policyState, writers }
}

function sectionOf(key: string): Section {
  if (key === POLICY_KEY) return 'policy'
  if (key.startsWith(WRITER_KEY_PREFIX)) return 'writers'
  return 'policyState'
}

function parseWriter(key: string, value: LexMap): SpaceHostWriter {
  const did = key.slice(WRITER_KEY_PREFIX.length)
  if (!isValidDid(did)) {
    throw new SpaceHostArchiveError(`invalid DID in writer key: ${key}`)
  }
  return { did, ...parseDef(defs.spaceHostWriter, value) }
}

function decodeMap(key: string, bytes: Uint8Array): LexMap {
  let value: LexValue
  try {
    value = decode(bytes)
  } catch (cause) {
    throw new SpaceHostArchiveError(`invalid cbor at ${key}`, { cause })
  }
  if (!isPlainObject(value)) {
    throw new SpaceHostArchiveError(`value at ${key} is not a map`)
  }
  return value
}

function parseDef<T>(def: Def<T>, data: unknown): T {
  try {
    return def.schema.parse(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new SpaceHostArchiveError(`invalid ${def.name}: ${message}`)
  }
}

function toPair(key: string, value: LexMap): StarPair {
  return { key: utf8(key), value: encode(value) }
}

function sortByKey(pairs: StarPair[]): StarPair[] {
  return pairs.sort((a, b) => compareBytes(a.key, b.key))
}
