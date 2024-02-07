import { Headers } from '@atproto/xrpc'
import { readStickyLogger as log } from '../logger'
import AppContext from '../context'
import { ApiRes, HandlerResponse, LocalRecords, MungeFn } from './types'
import { getRecordsSinceRev } from './viewer'
import { HandlerPipeThrough } from '@atproto/xrpc-server'
import { parseRes } from '../pipethrough'

const REPO_REV_HEADER = 'atproto-repo-rev'

export const getRepoRev = (headers: Headers): string | undefined => {
  return headers[REPO_REV_HEADER]
}

export const getLocalLag = (local: LocalRecords): number | undefined => {
  let oldest: string | undefined = local.profile?.indexedAt
  for (const post of local.posts) {
    if (!oldest || post.indexedAt < oldest) {
      oldest = post.indexedAt
    }
  }
  if (!oldest) return undefined
  return Date.now() - new Date(oldest).getTime()
}

export const handleReadAfterWrite = async <T>(
  ctx: AppContext,
  requester: string,
  res: ApiRes<T>,
  munge: MungeFn<T>,
): Promise<HandlerResponse<T>> => {
  try {
    return await readAfterWriteInternal(ctx, requester, res, munge)
  } catch (err) {
    log.warn({ err, requester }, 'error in read after write munge')
    return formatResponse(res.data)
  }
}

export const readAfterWriteInternal = async <T>(
  ctx: AppContext,
  requester: string,
  res: ApiRes<T>,
  munge: MungeFn<T>,
): Promise<HandlerResponse<T>> => {
  const rev = getRepoRev(res.headers)
  if (!rev) return formatResponse(res.data)
  return ctx.actorStore.read(requester, async (store) => {
    const local = await getRecordsSinceRev(store, rev)
    if (local.count === 0) {
      return formatResponse(res.data)
    }
    const keypair = await ctx.actorStore.keypair(requester)
    const localViewer = ctx.localViewer(store, keypair)
    const data = await munge(localViewer, res.data, local, requester)
    return formatResponse(data, getLocalLag(local))
  })
}

export const handleReadAfterWritePipeThrough = async <T>(
  ctx: AppContext,
  nsid: string,
  requester: string,
  res: HandlerPipeThrough,
  munge: MungeFn<T>,
): Promise<HandlerResponse<T> | HandlerPipeThrough> => {
  try {
    return await readAfterWritePipethroughInternal(
      ctx,
      nsid,
      requester,
      res,
      munge,
    )
  } catch (err) {
    log.warn({ err, requester }, 'error in read after write munge')
    return res
  }
}

export const readAfterWritePipethroughInternal = async <T>(
  ctx: AppContext,
  nsid: string,
  requester: string,
  res: HandlerPipeThrough,
  munge: MungeFn<T>,
): Promise<HandlerResponse<T> | HandlerPipeThrough> => {
  const rev = getRepoRev(res.headers ?? {})
  if (!rev) return res
  return ctx.actorStore.read(requester, async (store) => {
    const local = await getRecordsSinceRev(store, rev)
    if (local.count === 0) {
      return res
    }
    const keypair = await ctx.actorStore.keypair(requester)
    const localViewer = ctx.localViewer(store, keypair)
    const parsedRes = parseRes<T>(nsid, res)
    const data = await munge(localViewer, parsedRes, local, requester)
    return formatResponse(data, getLocalLag(local))
  })
}

export const formatResponse = <T>(
  body: T,
  lag?: number,
): HandlerResponse<T> => ({
  encoding: 'application/json',
  body,
  headers:
    lag !== undefined
      ? {
          'Atproto-Upstream-Lag': lag.toString(10),
        }
      : undefined,
})
