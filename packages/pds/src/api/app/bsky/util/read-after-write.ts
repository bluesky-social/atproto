import { Headers } from '@atproto/xrpc'
import { readStickyLogger as log } from '../../../../logger'
import { LocalRecords } from '../../../../actor-store/local/reader'
import AppContext from '../../../../context'
import { ActorStoreReader } from '../../../../actor-store'

export type ApiRes<T> = {
  headers: Headers
  data: T
}

export type MungeFn<T> = (
  actorStore: ActorStoreReader,
  original: T,
  local: LocalRecords,
  requester: string,
) => Promise<T>

export type HandlerResponse<T> = {
  encoding: 'application/json'
  body: T
  headers?: Record<string, string>
}

export const getRepoRev = (headers: Headers): string | undefined => {
  return headers['atproto-repo-rev']
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
  let body: T
  let lag: number | undefined = undefined
  try {
    const withLocal = await readAfterWriteInternal(ctx, requester, res, munge)
    body = withLocal.data
    lag = withLocal.lag
  } catch (err) {
    body = res.data
    log.warn({ err, requester }, 'error in read after write munge')
  }
  return {
    encoding: 'application/json',
    body,
    headers:
      lag !== undefined
        ? {
            'Atproto-Upstream-Lag': lag.toString(10),
          }
        : undefined,
  }
}

export const readAfterWriteInternal = async <T>(
  ctx: AppContext,
  requester: string,
  res: ApiRes<T>,
  munge: MungeFn<T>,
): Promise<{ data: T; lag?: number }> => {
  const rev = getRepoRev(res.headers)
  if (!rev) return { data: res.data }
  const store = ctx.actorStore.reader(requester)
  const local = await store.local.getRecordsSinceRev(rev)
  const data = await munge(store, res.data, local, requester)
  return {
    data,
    lag: getLocalLag(local),
  }
}
