import express from 'express'
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
  asPipeThroughBuffer,
  isJsonContentType,
  pipethrough,
} from '../pipethrough'
import { HandlerResponse, LocalRecords, MungeFn } from './types'

const MAX_BUFFER_SIZE = 10 * 1024 * 1024

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

  let result: HandlerPipeThroughBuffer | HandlerPipeThroughStream =
    await pipethrough(ctx, req, { iss: requester })

  const rev = result.headers?.['atproto-repo-rev']
  if (!rev) return result

  // Only json responses can be parsed for munging
  if (!isJsonContentType(result.encoding)) {
    return result
  }

  // If the response is not chunked, we can determine that the content is too
  // large to buffer without consuming the stream
  const contentLength = result.headers?.['content-length']
  if (contentLength && Number(contentLength) > MAX_BUFFER_SIZE) {
    return result
  }

  try {
    return await ctx.actorStore.read(requester, async (store) => {
      const local = await store.record.getRecordsSinceRev(rev)
      if (local.count === 0) return result

      // @NOTE we replace "result" to avoid accidentally using the stream after
      // it's been consumed by asPipeThroughBuffer, which would cause an error.
      // By replacing it with the buffered version, we ensure that any further
      // use of "result" is safe.
      result = await asPipeThroughBuffer(
        result as HandlerPipeThroughStream,
        MAX_BUFFER_SIZE,
      )

      // result was too big to buffer, skip munge
      if (!('buffer' in result)) {
        return result
      }

      const lex = lexParse(result.buffer.toString('utf8'), { strict: false })

      const parsed = method.output.schema.safeValidate(lex, { strict: false })

      // We won't perform munging with invalid upstream data
      if (!parsed.success) return result

      const parsedRes = parsed.value as l.InferMethodOutputBody<M, never>

      const localViewer = ctx.localViewer(store)

      const data = await munge(localViewer, parsedRes, local, requester)

      return formatMungedResponse(data, getLocalLag(local))
    })
  } catch (err) {
    log.warn({ err, requester }, 'error in read after write munge')

    return result
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
