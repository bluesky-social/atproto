import { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { Router } from 'express'
import { Dispatcher } from 'undici'
import { AppContext } from './context'
import { httpLogger } from './logger'

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

/**
 * Forward Sokaa AppView admin/internal routes (`/_sokaa/*`) through the public
 * PDS origin so production smoke and ops can reach video job endpoints without
 * exposing the AppView listen port.
 */
export const createRouter = (ctx: AppContext): Router => {
  const router = Router()
  const appview = ctx.cfg.sokaaAppView
  if (!appview) {
    return router
  }

  const origin = new URL(appview.url).origin

  router.use(async (req, res) => {
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.method !== 'POST' &&
      req.method !== 'DELETE' &&
      req.method !== 'PUT' &&
      req.method !== 'PATCH'
    ) {
      res.status(405).send('Method Not Allowed\n')
      return
    }

    const headers: Record<string, string | string[] | undefined> = {}
    for (const [name, value] of Object.entries(req.headers)) {
      if (HOP_BY_HOP.has(name.toLowerCase())) continue
      headers[name] = value
    }

    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : req

    // Mounted at `/_sokaa`; rebuild the AppView path from the mount + remainder.
    const remainder = req.url === '/' ? '' : req.url
    const path = `/_sokaa${remainder}`

    const dispatchOptions: Dispatcher.RequestOptions = {
      origin,
      method: req.method,
      path,
      body,
      headers,
      bodyTimeout: 120_000,
      headersTimeout: 120_000,
    }

    try {
      const upstream = await ctx.proxyAgent.request(dispatchOptions)
      res.status(upstream.statusCode)
      for (const [name, value] of Object.entries(upstream.headers)) {
        if (value == null) continue
        if (HOP_BY_HOP.has(name.toLowerCase())) continue
        res.setHeader(name, value)
      }
      const readable = upstream.body as Readable
      await pipeReadable(readable, res)
    } catch (err) {
      httpLogger.error({ err }, 'sokaa admin proxy failed')
      if (!res.headersSent) {
        res.status(502).send('Bad Gateway\n')
      } else {
        res.destroy(err instanceof Error ? err : undefined)
      }
    }
  })

  return router
}

function pipeReadable(
  readable: Readable,
  res: ServerResponse<IncomingMessage>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    readable.on('error', reject)
    res.on('error', reject)
    res.on('finish', resolve)
    readable.pipe(res)
  })
}
