import { Headers } from '@atproto/xrpc'
import { readStickyLogger as log } from '../logger'
import AppContext from '../context'
import { HandlerResponse, LocalRecords, MungeFn } from './types'
import { getRecordsSinceRev } from './viewer'
import { HandlerPipeThrough } from '@atproto/xrpc-server'
import { parseRes } from '../pipethrough'

const REPO_REV_HEADER = 'atproto-repo-rev'

export const getRepoRev = (headers?: Headers): string | undefined => {
  return headers?.[REPO_REV_HEADER]
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
  nsid: string,
  requester: string,
  res: HandlerPipeThrough,
  munge: MungeFn<T>,
): Promise<HandlerResponse<T> | HandlerPipeThrough> => {
  try {
    return await readAfterWriteInternal(ctx, nsid, requester, res, munge)
  } catch (err) {
    log.warn({ err, requester }, 'error in read after write munge')
    return res
  }
}

export const readAfterWriteInternal = async <T>(
  ctx: AppContext,
  nsid: string,
  requester: string,
  res: HandlerPipeThrough,
  munge: MungeFn<T>,
): Promise<HandlerResponse<T> | HandlerPipeThrough> => {
  const rev = getRepoRev(res.headers)
  if (!rev) return res

  // If the response's "atproto-repo-rev" header matches the current repo rev,
  // we can skip the munge step and return the response as-is.
  const repoRev = await ctx.repoRevCache?.get(requester)
  if (repoRev === rev) return res

  return ctx.actorStore.read(requester, async (store) => {
    // Since we have a connection to the database, take the opportunity to
    // update the repoRevCache with the current repo rev so that future requests
    // from this requester can skip the munge step.
    if (repoRev == null && ctx.repoRevCache) {
      const { rev } = await store.repo.storage.getRootDetailed()
      ctx.repoRevCache.set(requester, rev)
    }

    const local = await getRecordsSinceRev(store, rev)
    if (local.count === 0) {
      return res
    }
    const localViewer = ctx.localViewer(store)
    const parsedRes = parseRes<T>(nsid, res)
    const data = await munge(localViewer, parsedRes, local, requester)
    return formatMungedResponse(data, getLocalLag(local))
  })
}

export const formatMungedResponse = <T>(
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
