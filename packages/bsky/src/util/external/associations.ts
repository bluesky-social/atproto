import type { LexMap, TypedLexMap } from '@atproto/lex-data'
import type { AtUriString } from '@atproto/lex-schema'
import { parseAtUriString } from '@atproto/syntax'
import type {
  ExternalRecord,
  ExternalRecords,
} from '../../hydration/external.js'
import { com, site, social } from '../../lexicons/index.js'

type StrongRef = com.atproto.repo.strongRef.Main

/**
 * Persistence policy, not render-time hydration: the canonical record (when
 * available, whatever its collection) plus only the additional collections
 * opted in here, so records baked into a post stay slim. Hydration still holds
 * the full state (e.g. recommendation, subscription and favorite records that
 * back the rendered `likers`/`subscribers` previews); those are deliberately
 * not persisted. An absent entry means no additional collections. Add a
 * collection here only when a post must carry it.
 */
const PERSISTED_DEPENDENCY_COLLECTIONS: ReadonlyMap<string, readonly string[]> =
  new Map<string, readonly string[]>([
    [site.standard.document.$type, [site.standard.publication.$type]],
    [
      social.grain.gallery.$type,
      [social.grain.gallery.item.$type, social.grain.photo.$type],
    ],
  ])

const collectionOf = (uri: AtUriString): string | undefined => {
  const parsed = parseAtUriString(uri)
  return parsed.success ? parsed.value.collection : undefined
}

/**
 * The canonical record, then the hydrated dependencies whose URI collection is
 * opted in by `PERSISTED_DEPENDENCY_COLLECTIONS` for the canonical collection.
 * Refs and associatedRecords are index-aligned, with CIDs taken from
 * hydration; unavailable records are excluded. `canonicalInfo`, when given,
 * is the selected canonical record (e.g. a pinned version) instead of the one
 * keyed by `canonicalUri` in `records`.
 */
export const collectAssociations = (
  canonicalUri: AtUriString,
  records: ExternalRecords,
  canonicalInfo?: ExternalRecord | null,
): { associatedRefs: StrongRef[]; associatedRecords: LexMap[] } => {
  const associatedRefs: StrongRef[] = []
  const associatedRecords: LexMap[] = []
  const canonicalCollection = collectionOf(canonicalUri)
  const persisted =
    (canonicalCollection &&
      PERSISTED_DEPENDENCY_COLLECTIONS.get(canonicalCollection)) ||
    []
  const uris = [
    canonicalUri,
    ...[...records.keys()].filter((uri) => uri !== canonicalUri),
  ]
  for (const uri of uris) {
    const info =
      uri === canonicalUri && canonicalInfo !== undefined
        ? canonicalInfo
        : records.get(uri)
    if (!info) continue
    if (uri !== canonicalUri) {
      const collection = collectionOf(uri)
      if (!collection || !persisted.includes(collection)) continue
    }
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
    )
    associatedRecords.push(info.record as TypedLexMap)
  }
  return { associatedRefs, associatedRecords }
}
