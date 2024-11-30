import { jsonToLex } from '@atproto/lexicon'
import { HeadersMap } from '@atproto/xrpc'
import {
  HandlerPipeThrough,
  HandlerPipeThroughBuffer,
  parseReqNsid,
} from '@atproto/xrpc-server'
import express from 'express'

import AppContext from '../context'
import { lexicons } from '../lexicon/lexicons'
import { readStickyLogger as log } from '../logger'
import {
  asPipeThroughBuffer,
  isJsonContentType,
  pipethrough,
} from '../pipethrough'
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
  munge: MungeFn<T>,
): Promise<HandlerResponse<T> | HandlerPipeThrough> => {
  const { req, auth } = reqCtx
  const requester = auth.credentials.did

  const streamRes = await pipethrough(ctx, req, { iss: requester })

  const rev = getRepoRev(streamRes.headers)
  if (!rev) return streamRes

  if (isJsonContentType(streamRes.headers['content-type']) === false) {
    // content-type is present but not JSON, we can't munge this
    return streamRes
  }

  // if the munging fails, we can't return the original response because the
  // stream will already have been read. If we end-up buffering the response,
  // we'll return the buffered response in case of an error.
  let bufferRes: HandlerPipeThroughBuffer | undefined

  try {
    const lxm = parseReqNsid(req)

    return await ctx.actorStore.read(requester, async (store) => {
      const local = await getRecordsSinceRev(store, rev)
      if (local.count === 0) return streamRes

      const { buffer } = (bufferRes = await asPipeThroughBuffer(streamRes))

      const lex = jsonToLex(JSON.parse(buffer.toString('utf8')))

      const parsedRes = lexicons.assertValidXrpcOutput(lxm, lex) as T

      const localViewer = ctx.localViewer(store)

      const data = await munge(localViewer, parsedRes, local, requester)
      return formatMungedResponse(data, getLocalLag(local))
    })
  } catch (err) {
    // The error occurred while reading the stream, this is non-recoverable
    if (!bufferRes && !streamRes.stream.readable) throw err

    log.warn({ err, requester }, 'error in read after write munge')
    return bufferRes ?? streamRes
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
