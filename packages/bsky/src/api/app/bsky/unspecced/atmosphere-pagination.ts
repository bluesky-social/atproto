import {
  type AtUriString,
  type DidString,
  type NsidString,
  isDidString,
} from '@atproto/lex'
import { parseAtUriString } from '@atproto/syntax'
import { InvalidRequestError, UpstreamFailureError } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { asInvalidRequest } from '../../../../data-plane/index.js'
import type { HydrateCtxWithViewer } from '../../../../hydration/hydrator.js'
import { app } from '../../../../lexicons/index.js'
import {
  atmosphereWindow,
  groupAtmosphereActivities,
} from './atmosphere-grouping.js'
import { AtmosphereTimelineHydrator } from './atmosphere-hydration.js'

const BATCH_SIZE = 50
const MAX_BATCHES = 5
const INITIAL_RETAINED = 100
const SOFT_RETAINED_LIMIT = 200
const MAX_CURSOR_LENGTH = 8192
const MAX_NATIVE_CURSOR_LENGTH = 4096

type Root = {
  uri: AtUriString
  sortedAt: number
  position: number
}

type Bucket = {
  author: DidString
  collection: NsidString
  retained: number
  overflow: number
  position: number
}

/** Consume whole native batches, then group only the visible activity on this page. */
export async function loadAtmosphereTimeline(
  ctx: Pick<AppContext, 'hydrator' | 'views'>,
  hydrateCtx: HydrateCtxWithViewer,
  cursor: string | undefined,
  now: number,
): Promise<app.bsky.unspecced.getAtmosphereTimeline.$OutputBody> {
  const viewer = hydrateCtx.viewer as DidString
  let next = cursor === undefined ? undefined : decodeCursor(cursor, viewer)
  let terminal = false
  let batchesFetched = 0
  let position = 0
  const roots: Root[] = []
  const seenUris = new Set<string>()
  const seenCursors = new Set<string>()
  const buckets = new Map<string, Bucket>()
  const hydration = new AtmosphereTimelineHydrator(ctx, hydrateCtx, now)

  async function fetchBatch() {
    batchesFetched++
    const requestCursor = next
    if (requestCursor !== undefined) seenCursors.add(requestCursor)
    const page = await ctx.hydrator.external
      .getAtmosphereTimeline(viewer, {
        limit: BATCH_SIZE,
        cursor: requestCursor,
      })
      .catch(asInvalidRequest())
    for (const item of page.items) {
      if (seenUris.has(item.uri)) continue
      const parsed = parseAtUriString(item.uri)
      if (
        !parsed.success ||
        !isDidString(parsed.value.authority) ||
        !parsed.value.collection ||
        !parsed.value.rkey ||
        parsed.value.query !== undefined ||
        parsed.value.hash !== undefined
      )
        continue
      seenUris.add(item.uri)
      const { authority: author, collection } = parsed.value
      const key = `${author}\0${collection}`
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { author, collection, retained: 0, overflow: 0, position: 0 }
        buckets.set(key, bucket)
      }
      if (bucket.retained < 5) {
        bucket.retained++
        roots.push({
          uri: item.uri,
          sortedAt: item.sortedAt.getTime(),
          position,
        })
      } else {
        if (bucket.overflow === 0) bucket.position = position
        bucket.overflow++
      }
      position++
    }
    next = page.cursor
    terminal = next === undefined
    if (
      next !== undefined &&
      (next.length > MAX_NATIVE_CURSOR_LENGTH || seenCursors.has(next))
    ) {
      throw new UpstreamFailureError('Invalid Atmosphere timeline continuation')
    }
  }

  while (
    roots.length < INITIAL_RETAINED &&
    !terminal &&
    batchesFetched < MAX_BATCHES
  )
    await fetchBatch()
  await hydration.hydrate(roots.map(({ uri }) => uri))
  const visible = () =>
    roots.flatMap(({ uri, sortedAt }) => {
      const activity = hydration.activity(uri, sortedAt)
      return activity ? [activity] : []
    })
  let activities = visible()
  while (
    !terminal &&
    batchesFetched < MAX_BATCHES &&
    roots.length <= SOFT_RETAINED_LIMIT &&
    !hasGap(activities, now)
  ) {
    const previousCount = roots.length
    await fetchBatch()
    await hydration.hydrate(roots.slice(previousCount).map(({ uri }) => uri))
    activities = visible()
  }

  const positions = new Map(roots.map(({ uri, position }) => [uri, position]))
  const output = groupAtmosphereActivities(activities, now).map((item) => ({
    position: positions.get(
      'items' in item ? item.items[0].record.uri : item.record.uri,
    )!,
    item: item as app.bsky.unspecced.getAtmosphereTimeline.$OutputBody['feed'][number],
  }))
  for (const bucket of buckets.values()) {
    if (!bucket.overflow) continue
    const profile = hydration.profile(bucket.author)
    if (!profile) continue
    output.push({
      position: bucket.position,
      item: app.bsky.unspecced.getAtmosphereTimeline.atmosphereItemOverflow.$build(
        {
          collection: bucket.collection,
          count: bucket.overflow,
          associatedProfiles: [profile],
        },
      ),
    })
  }
  output.sort((a, b) => a.position - b.position)
  return {
    feed: output.map(({ item }) => item),
    cursor: terminal ? undefined : encodeCursor(next!, viewer),
  }
}

function hasGap(activities: { sortedAt: number }[], now: number): boolean {
  for (let index = 10; index < activities.length; index++) {
    const newer = activities[index - 1].sortedAt
    if (newer - activities[index].sortedAt > atmosphereWindow(now - newer))
      return true
  }
  return false
}

function encodeCursor(cursor: string, viewer: DidString): string {
  const encoded = Buffer.from(
    JSON.stringify({ v: 1, viewer, cursor }),
  ).toString('base64url')
  if (encoded.length > MAX_CURSOR_LENGTH) {
    throw new UpstreamFailureError('Atmosphere timeline cursor is too large')
  }
  return encoded
}

function decodeCursor(cursor: string, viewer: DidString): string {
  try {
    if (cursor.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new Error()
    const bytes = Buffer.from(cursor, 'base64url')
    if (bytes.toString('base64url') !== cursor) throw new Error()
    const value: unknown = JSON.parse(bytes.toString('utf8'))
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !('v' in value) ||
      value.v !== 1 ||
      !('viewer' in value) ||
      value.viewer !== viewer ||
      !('cursor' in value) ||
      typeof value.cursor !== 'string' ||
      !value.cursor.length ||
      value.cursor.length > MAX_NATIVE_CURSOR_LENGTH ||
      Object.keys(value).length !== 3
    )
      throw new Error()
    return value.cursor
  } catch {
    throw new InvalidRequestError('Invalid Atmosphere timeline cursor')
  }
}
