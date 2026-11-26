import { dedupeStrs } from '@atproto/common'
import { AtUri, isDidIdentifier, normalizeHandle } from '@atproto/syntax'
import type { DatabaseSchema } from '../db/database-schema.js'

/**
 * Rewrites handle authorities in at-uris to DIDs using the actor table, so
 * indexed references always match canonical DID-form record URIs. URIs that
 * already use a DID, or whose handle cannot be resolved, are left unchanged.
 */
export const normalizeUriAuthorities = async (
  db: DatabaseSchema,
  uris: string[],
): Promise<string[]> => {
  const parsed = uris.map((uri) => new AtUri(uri))
  const handles = dedupeStrs(
    parsed
      .map((uri) => uri.host)
      .filter((host) => !isDidIdentifier(host))
      .map((host) => normalizeHandle(host)),
  )
  if (!handles.length) return uris
  const actors = await db
    .selectFrom('actor')
    .where('handle', 'in', handles)
    .select(['handle', 'did'])
    .execute()
  const didByHandle = new Map(
    actors.map((actor) => [normalizeHandle(actor.handle ?? ''), actor.did]),
  )
  return uris.map((uri, i) => {
    const parsedUri = parsed[i]
    if (isDidIdentifier(parsedUri.host)) return uri
    const did = didByHandle.get(normalizeHandle(parsedUri.host))
    if (!did) return uri
    parsedUri.hostname = did
    return parsedUri.toString()
  })
}
