import { timingSafeEqual } from 'node:crypto'
import { type NextFunction, type Request, type Response, Router } from 'express'
import {
  CloudflareStreamClient,
  HttpReadinessChecker,
  StreamUidMismatchError,
  VideoJobService,
  isAllowedMediaSourceUrl,
  mediaSourceUrl,
} from '@atproto/video-processing'
import { AppContext } from '../context'
import { Database } from '../data-plane/server/db'
import { DbVideoAssetStore } from './db-asset-store'

export type VideoRouteDeps = {
  ctx: AppContext
  db: Database
}

/**
 * Internal video processing routes.
 * - POST /_sokaa/video/jobs — admin basic-auth; submit/copy to Cloudflare Stream
 * - DELETE /_sokaa/video/jobs/:did/:cid — admin basic-auth; takedown
 * - POST /_sokaa/video/webhooks/stream — webhook secret (not admin basic);
 *   Stream (or a proxy) notifies readiness
 */
export function createVideoRouter(
  deps: VideoRouteDeps & { service?: VideoJobService | null },
): Router {
  const router = Router()
  const service =
    deps.service !== undefined ? deps.service : createJobService(deps)

  router.post('/jobs', requireAdmin(deps), async (req, res) => {
    if (!service) {
      res.status(503).send('Stream credentials not configured\n')
      return
    }
    const did = String(req.body?.did ?? '')
    const videoCid = String(req.body?.videoCid ?? '')
    if (!did || !videoCid) {
      res.status(400).send('did and videoCid required\n')
      return
    }
    const sourceUrl =
      typeof req.body?.sourceUrl === 'string' && req.body.sourceUrl
        ? req.body.sourceUrl
        : mediaSourceUrl(deps.ctx.cfg.cdnUrl, did, videoCid)
    if (!isAllowedMediaSourceUrl(sourceUrl, deps.ctx.cfg.cdnUrl)) {
      res.status(400).send('sourceUrl must be a media-gateway /v1/media URL\n')
      return
    }
    const record = await service.submit({ did, videoCid, sourceUrl })
    res.status(200).json(record)
  })

  router.post('/webhooks/stream', requireWebhookSecret(), async (req, res) => {
    if (!service) {
      res.status(503).send('Stream credentials not configured\n')
      return
    }
    const did = String(req.body?.meta?.did ?? req.body?.did ?? '')
    const videoCid = String(
      req.body?.meta?.videoCid ?? req.body?.videoCid ?? '',
    )
    const streamUid = String(req.body?.uid ?? req.body?.streamUid ?? '')
    if (!did || !videoCid || !streamUid) {
      res.status(400).send('did, videoCid, and stream uid required\n')
      return
    }
    try {
      const record = await service.markReadyFromWebhook(
        did,
        videoCid,
        streamUid,
      )
      if (!record) {
        res.status(404).json({ ok: false })
        return
      }
      res.status(200).json(record)
    } catch (err) {
      if (err instanceof StreamUidMismatchError) {
        res.status(409).send('stream uid mismatch\n')
        return
      }
      throw err
    }
  })

  router.delete('/jobs/:did/:cid', requireAdmin(deps), async (req, res) => {
    if (!service) {
      res.status(503).send('Stream credentials not configured\n')
      return
    }
    const did = decodeURIComponent(req.params.did)
    const videoCid = decodeURIComponent(req.params.cid)
    const record = await service.delete(did, videoCid)
    res.status(200).json(record ?? { ok: false })
  })

  return router
}

function requireAdmin(deps: VideoRouteDeps) {
  return (req: Request, res: Response, next: NextFunction) => {
    const creds = deps.ctx.authVerifier.parseRoleCreds(req)
    if (!creds.admin) {
      res.set('WWW-Authenticate', 'Basic realm="sokaa-video"')
      res.status(401).send('Unauthorized\n')
      return
    }
    next()
  }
}

function requireWebhookSecret() {
  return (req: Request, res: Response, next: NextFunction) => {
    const expected = process.env.SOKAA_STREAM_WEBHOOK_SECRET?.trim()
    if (!expected) {
      res.status(503).send('Webhook secret not configured\n')
      return
    }
    const provided =
      bearerToken(req.headers.authorization) ??
      headerString(req.headers['x-sokaa-webhook-secret'])
    if (!provided || !timingSafeSecretEqual(provided, expected)) {
      res.status(401).send('Unauthorized\n')
      return
    }
    next()
  }
}

function timingSafeSecretEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  return match?.[1]?.trim() || undefined
}

function headerString(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim() || undefined
  }
  return
}

function createJobService(deps: VideoRouteDeps): VideoJobService | null {
  const accountId = process.env.SOKAA_STREAM_ACCOUNT_ID?.trim()
  const apiToken = process.env.SOKAA_STREAM_API_TOKEN?.trim()
  const customerSubdomain = process.env.SOKAA_STREAM_CUSTOMER_SUBDOMAIN?.trim()
  if (!accountId || !apiToken || !customerSubdomain) {
    return null
  }
  return new VideoJobService(
    new DbVideoAssetStore(deps.db),
    new CloudflareStreamClient({ accountId, apiToken, customerSubdomain }),
    new HttpReadinessChecker(),
  )
}
