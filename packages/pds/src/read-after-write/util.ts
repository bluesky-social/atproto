import { Readable } from 'node:stream'
import express from 'express'
import { decodeStream, omit } from '@atproto/common'
import { LexValue, l } from '@atproto/lex'
import { lexParse } from '@atproto/lex-json'
import {
  HandlerPipeThrough,
  HandlerPipeThroughBuffer,
  HandlerPipeThroughStream,
} from '@atproto/xrpc-server'
import { AppContext } from '../context'
import { readStickyLogger as log } from '../logger'
import {
  bufferUpstreamResponseMaybe,
  isJsonContentType,
  pipethrough,
} from '../pipethrough'
import { HandlerResponse, LocalRecords, MungeFn } from './types'

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

export const pipethroughReadAfterWrite = async <
  M extends (l.Query | l.Procedure) & {
    output: l.Payload<`application/json`, l.Schema<LexValue>>
  },
>(
  ctx: AppContext,
  reqCtx: { req: express.Request; auth: { credentials: { did: string } } },
  ns: l.Main<M>,
  munge: MungeFn<l.InferMethodOutputBody<M>>,
): Promise<
  HandlerResponse<l.InferMethodOutputBody<M>> | HandlerPipeThrough
> => {
  const { req, auth } = reqCtx
  const requester = auth.credentials.did
  const method = l.getMain(ns)

  const streamRes = await pipethrough(ctx, req, { iss: requester })

  const rev = streamRes.headers['atproto-repo-rev']
  if (!rev) return streamRes

  if (isJsonContentType(streamRes.headers['content-type']) === false) {
    // content-type is present but not JSON, we can't munge this
    return streamRes
  }

  const buffered = await bufferUpstreamResponseMaybe(streamRes)

  // response is too big to buffer, skip munge and return the stream
  if ('stream' in buffered) return buffered

  try {
    const lex = lexParse(buffered.buffer.toString('utf8'), { strict: false })

    const original = method.output.schema.validate(lex, {
      strict: false,
    }) as l.InferMethodOutputBody<M, never>

    return await ctx.actorStore.read(requester, async (store) => {
      const local = await store.record.getRecordsSinceRev(rev)
      if (local.count === 0) return buffered

      const localViewer = ctx.localViewer(store)

      const data = await munge(localViewer, original, local, requester)

      return formatMungedResponse(data, getLocalLag(local))
    })
  } catch (err) {
    log.warn({ err, requester }, 'error in read after write munge')

    return buffered
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
