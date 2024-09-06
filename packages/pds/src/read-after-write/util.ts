import { jsonToLex } from '@atproto/lexicon'
import { HeadersMap } from '@atproto/xrpc'
import {
  HandlerPipeThrough,
  HandlerPipeThroughBuffer,
} from '@atproto/xrpc-server'
import express from 'express'

import AppContext from '../context'
import { lexicons } from '../lexicon/lexicons'
import { readStickyLogger as log } from '../logger'
import { collect, pipethrough, safeParseJson } from '../pipethrough'
import { HandlerResponse, LocalRecords, MungeFn } from './types'
import { getRecordsSinceRev } from './viewer'

const REPO_REV_HEADER = 'atproto-repo-rev'

export const getRepoRev = (headers: HeadersMap): string | undefined => {
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

export const pipethroughReadAfterWrite = async <T>(
  ctx: AppContext,
  reqCtx: { req: express.Request; auth: { credentials: { did: string } } },
  nsid: string,
  munge: MungeFn<T>,
): Promise<HandlerResponse<T> | HandlerPipeThrough> => {
  const { req, auth } = reqCtx
  const requester = auth.credentials.did

  const upstreamRes = await pipethrough(ctx, req, requester)

  const rev = upstreamRes.headers && getRepoRev(upstreamRes.headers)
  if (!rev) return upstreamRes

  const buffer = await collect(upstreamRes.stream)

  const res: HandlerPipeThroughBuffer = {
    encoding: upstreamRes.encoding,
    headers: upstreamRes.headers,
    buffer: buffer.buffer,
  }

  try {
    return await ctx.actorStore.read(requester, async (store) => {
      const local = await getRecordsSinceRev(store, rev)
      if (local.count === 0) {
        return res
      }
      const localViewer = ctx.localViewer(store)

      const value = safeParseJson(Buffer.from(res.buffer).toString('utf8'))
      const lex = value && jsonToLex(value)

      const parsedRes = lexicons.assertValidXrpcOutput(nsid, lex) as T

      const data = await munge(localViewer, parsedRes, local, requester)
      return formatMungedResponse(data, getLocalLag(local))
    })
  } catch (err) {
    log.warn({ err, requester }, 'error in read after write munge')
    return res
  }
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
