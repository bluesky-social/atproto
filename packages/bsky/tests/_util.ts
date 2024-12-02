import { AtUri } from '@atproto/syntax'
import { lexToJson } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  FeedViewPost,
  PostView,
  isPostView,
  isReasonRepost,
  isThreadViewPost,
} from '../src/lexicon/types/app/bsky/feed/defs'
import { isViewRecord } from '../src/lexicon/types/app/bsky/embed/record'
import { isView as isRecordView } from '../src/lexicon/types/app/bsky/embed/record'
import { isView as isRecordWithMediaView } from '../src/lexicon/types/app/bsky/embed/recordWithMedia'
import { AppBskyFeedGetPostThread } from '@atproto/api'
import {
  LabelerView,
  isLabelerView,
  isLabelerViewDetailed,
} from '../src/lexicon/types/app/bsky/labeler/defs'
import { $Typed } from '../src/lexicon/util'

type ThreadViewPost = Extract<
  AppBskyFeedGetPostThread.OutputSchema['thread'],
  { post: { uri: string } }
>

export function assertIsThreadViewPost(
  value: unknown,
): asserts value is ThreadViewPost {
  expect(value).toMatchObject({
    $type: 'app.bsky.feed.defs#threadViewPost',
  })
}

// Swap out identifiers and dates with stable
// values for the purpose of snapshot testing
export const forSnapshot = (obj: unknown) => {
  const records = { [kTake]: 'record' }
  const collections = { [kTake]: 'collection' }
  const users = { [kTake]: 'user' }
  const cids = { [kTake]: 'cids' }
  const unknown = { [kTake]: 'unknown' }
  const toWalk = lexToJson(obj as any) // remove any blobrefs/cids
  return mapLeafValues(toWalk, (item) => {
    const asCid = CID.asCID(item)
    if (asCid !== null) {
      return take(cids, asCid.toString())
    }
    if (typeof item !== 'string') {
      return item
    }
    const str = item.startsWith('did:plc:') ? `at://${item}` : item
    if (str.startsWith('at://')) {
      const uri = new AtUri(str)
      if (uri.rkey) {
        return take(records, str)
      }
      if (uri.collection) {
        return take(collections, str)
      }
      if (uri.hostname) {
        return take(users, str)
      }
      return take(unknown, str)
    }
    if (str.match(/^\d{4}-\d{2}-\d{2}T/)) {
      if (str.match(/\d{6}Z$/)) {
        return constantDate.replace('Z', '000Z') // e.g. microseconds in record createdAt
      } else if (str.endsWith('+00:00')) {
        return constantDate.replace('Z', '+00:00') // e.g. timezone in record createdAt
      } else {
        return constantDate
      }
    }
    if (str.match(/^\d+__bafy/)) {
      return constantKeysetCursor
    }
    if (str.match(/\/img\/[^/]+\/.+\/did:plc:[^/]+\/[^/]+@[\w]+$/)) {
      // Match image urls
      const match = str.match(
        /\/img\/[^/]+\/.+\/(did:plc:[^/]+)\/([^/]+)@[\w]+$/,
      )
      if (!match) return str
      const [, did, cid] = match
      return str.replace(did, take(users, did)).replace(cid, take(cids, cid))
    }
    if (str.match(/\/vid\/did%3Aplc%3A[^/]+\/[^/]+\/[^/]+$/)) {
      // Match video urls
      const match = str.match(/\/vid\/(did%3Aplc%3A[^/]+)\/([^/]+)\/[^/]+$/)
      if (!match) return str
      const [, did, cid] = match
      return str
        .replace(did, take(users, decodeURIComponent(did)))
        .replace(cid, take(cids, cid))
    }
    let isCid: boolean
    try {
      CID.parse(str)
      isCid = true
    } catch (_err) {
      isCid = false
    }
    if (isCid) {
      return take(cids, str)
    }
    return item
  })
}

// Feed testing utils

export const getOriginator = (item: FeedViewPost) => {
  if (!item.reason) {
    return item.post.author.did
  } else if (isReasonRepost(item.reason)) {
    return item.reason.by.did
  } else {
    throw new Error('Unexpected reason')
  }
}

// Useful for remapping ids in snapshot testing, to make snapshots deterministic.
// E.g. you may use this to map this:
//   [{ uri: 'did://rad'}, { uri: 'did://bad' }, { uri: 'did://rad'}]
// to this:
//   [{ uri: '0'}, { uri: '1' }, { uri: '0'}]
const kTake = Symbol('take')
export function take(obj: Record<string, number>, value: string): string
export function take(
  obj: Record<string, number>,
  value?: string,
): string | undefined
export function take(
  obj: { [s: string]: number; [kTake]?: string },
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return
  }
  if (!(value in obj)) {
    obj[value] = Object.keys(obj).length
  }
  const kind = obj[kTake]
  return typeof kind === 'string'
    ? `${kind}(${obj[value]})`
    : String(obj[value])
}

export const constantDate = new Date(0).toISOString()
export const constantKeysetCursor = '0000000000000__bafycid'

const mapLeafValues = (
  obj: unknown,
  fn: (val: unknown) => unknown,
): unknown => {
  if (Array.isArray(obj)) {
    return obj.map((item) => mapLeafValues(item, fn))
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).reduce(
      (collect, [name, value]) =>
        Object.assign(collect, { [name]: mapLeafValues(value, fn) }),
      {},
    )
  }
  return fn(obj)
}

export const paginateAll = async <T extends { cursor?: string }>(
  fn: (cursor?: string) => Promise<T>,
  limit = Infinity,
): Promise<T[]> => {
  const results: T[] = []
  let cursor
  do {
    const res = await fn(cursor)
    results.push(res)
    cursor = res.cursor
  } while (cursor && results.length < limit)
  return results
}

// @NOTE mutates
export const stripViewer = <T extends { viewer?: unknown }>(
  val: T,
): Omit<T, 'viewer'> => {
  delete val.viewer
  return val
}

// @NOTE mutates
export function stripViewerFromPost(
  postUnknown: object,
  withType?: false,
): PostView
export function stripViewerFromPost(
  postUnknown: object,
  withType: true,
): $Typed<PostView>
export function stripViewerFromPost(
  postUnknown: object,
  withType = false,
): PostView {
  if ('$type' in postUnknown && !isPostView(postUnknown)) {
    throw new Error('Expected post view')
  }
  const post = postUnknown as PostView
  if (withType) {
    post.$type = 'app.bsky.feed.defs#postView'
  } else {
    delete post.$type
  }
  post.author = stripViewer(post.author)
  const recordEmbed = isRecordView(post.embed)
    ? isViewRecord(post.embed.record)
      ? post.embed.record
      : undefined
    : isRecordWithMediaView(post.embed)
      ? isViewRecord(post.embed.record.record)
        ? post.embed.record.record
        : undefined
      : undefined

  if (recordEmbed) {
    recordEmbed.author = stripViewer(recordEmbed.author)
    recordEmbed.embeds?.forEach((deepEmbed) => {
      const deepRecordEmbed = isRecordView(deepEmbed)
        ? isViewRecord(deepEmbed.record)
          ? deepEmbed.record
          : undefined
        : isRecordWithMediaView(deepEmbed)
          ? isViewRecord(deepEmbed.record.record)
            ? deepEmbed.record.record
            : undefined
          : undefined
      if (deepRecordEmbed) {
        deepRecordEmbed.author = stripViewer(deepRecordEmbed.author)
      }
    })
  }
  return stripViewer(post)
}

// @NOTE mutates
export const stripViewerFromThread = <T>(thread: T): T => {
  if (!isThreadViewPost(thread)) return thread
  // @ts-expect-error
  delete thread.viewer
  thread.post = stripViewerFromPost(thread.post)
  if (isThreadViewPost(thread.parent)) {
    thread.parent = stripViewerFromThread(thread.parent)
  }
  if (thread.replies) {
    thread.replies = thread.replies.map(stripViewerFromThread)
  }
  return thread
}

// @NOTE mutates
export const stripViewerFromLabeler = (serviceUnknown: object): LabelerView => {
  if (
    '$type' in serviceUnknown &&
    !isLabelerView(serviceUnknown) &&
    !isLabelerViewDetailed(serviceUnknown)
  ) {
    throw new Error('Expected mod service view')
  }
  const labeler = serviceUnknown as LabelerView
  labeler.creator = stripViewer(labeler.creator)
  return stripViewer(labeler)
}
