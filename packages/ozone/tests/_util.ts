import { type RequestListener, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createHttpTerminator } from 'http-terminator'
import { CID } from 'multiformats/cid'
import {
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyFeedDefs,
} from '@atproto/api'
import { lexToJson } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'

export const identity = <T>(x: T) => x

// Swap out identifiers and dates with stable
// values for the purpose of snapshot testing
export const forSnapshot = (obj: unknown) => {
  const records = { [kTake]: 'record' }
  const collections = { [kTake]: 'collection' }
  const users = { [kTake]: 'user' }
  const cids = { [kTake]: 'cids' }
  const sigs = { [kTake]: 'sig' }
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
    if (str.match(/^\d+::bafy/)) {
      return constantKeysetCursor
    }
    if (str.match(/\/img\/[^/]+\/.+\/did:plc:[^/]+\/[^/@]+(?:@[\w]+)?$/)) {
      // Match image urls, stripping optional format suffix (e.g. @webp) for stable snapshots
      const match = str.match(
        /\/img\/[^/]+\/.+\/(did:plc:[^/]+)\/([^/@]+)(?:@[\w]+)?$/,
      )
      if (!match) return str
      const [, did, cid] = match
      return str
        .replace(did, take(users, did))
        .replace(new RegExp(`${cid}(?:@\\w+)?`), take(cids, cid))
    }
    // decent check for 64-byte base64 encoded signatures
    if (str.length === 86 && !str.includes(' ')) {
      return take(sigs, str)
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

export const getOriginator = (item: AppBskyFeedDefs.FeedViewPost) => {
  if (AppBskyFeedDefs.isReasonRepost(item.reason)) {
    return item.reason.by.did
  } else {
    return item.post.author.did
  }
}

// Useful for remapping ids in snapshot testing, to make snapshots deterministic.
// E.g. you may use this to map this:
//   [{ uri: 'did://rad'}, { uri: 'did://bad' }, { uri: 'did://rad'}]
// to this:
//   [{ uri: '0'}, { uri: '1' }, { uri: '0'}]
const kTake = Symbol('take')
export function take(obj, value: string): string
export function take(obj, value: string | undefined): string | undefined
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
export const constantKeysetCursor = '0000000000000::bafycid'

const mapLeafValues = (obj: unknown, fn: (val: unknown) => unknown) => {
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
export const stripViewer = <T extends { viewer?: unknown }>(val: T): T => {
  delete val.viewer
  return val
}

const extractRecordEmbed = (embed: AppBskyFeedDefs.PostView['embed']) =>
  AppBskyEmbedRecord.isView(embed)
    ? AppBskyEmbedRecord.isViewRecord(embed.record)
      ? embed.record
      : undefined
    : AppBskyEmbedRecordWithMedia.isView(embed)
      ? AppBskyEmbedRecord.isViewRecord(embed.record.record)
        ? embed.record.record
        : undefined
      : undefined

// @NOTE mutates
export const stripViewerFromPost = (
  postUnknown: object,
): AppBskyFeedDefs.PostView => {
  if ('$type' in postUnknown && !AppBskyFeedDefs.isPostView(postUnknown)) {
    throw new Error('Expected post view')
  }
  const post = postUnknown as AppBskyFeedDefs.PostView
  post.author = stripViewer(post.author)

  const recordEmbed = extractRecordEmbed(post.embed)
  if (recordEmbed) {
    recordEmbed.author = stripViewer(recordEmbed.author)
    recordEmbed.embeds?.forEach((deepEmbed) => {
      const deepRecordEmbed = extractRecordEmbed(deepEmbed)
      if (deepRecordEmbed) {
        deepRecordEmbed.author = stripViewer(deepRecordEmbed.author)
      }
    })
  }
  return stripViewer(post)
}

// @NOTE mutates
export const stripViewerFromThread = <T extends AppBskyFeedDefs.ThreadViewPost>(
  thread: T,
): Omit<T, 'viewer'> => {
  if (!AppBskyFeedDefs.isThreadViewPost(thread)) return thread
  // @ts-expect-error
  delete thread.viewer
  thread.post = stripViewerFromPost(thread.post)
  if (AppBskyFeedDefs.isThreadViewPost(thread.parent)) {
    thread.parent = stripViewerFromThread(thread.parent)
  }
  if (thread.replies) {
    thread.replies = thread.replies.map((r) =>
      AppBskyFeedDefs.isThreadViewPost(r) ? stripViewerFromThread(r) : r,
    )
  }
  return thread
}

export async function startServer(listener: RequestListener) {
  return new Promise<AsyncDisposable & { port: number }>((resolve, reject) => {
    const onListen = () => {
      const port = (server.address() as AddressInfo).port
      resolve({ port, [Symbol.asyncDispose]: () => terminator.terminate() })
      cleanup()
    }
    const onError = (err: Error) => {
      reject(err)
      cleanup()
    }
    const cleanup = () => {
      server.removeListener('listening', onListen)
      server.removeListener('error', onError)
    }

    const server = createServer(listener)
      .listen(0)
      .once('listening', onListen)
      .once('error', onError)

    const terminator = createHttpTerminator({ server })
  })
}
