import { Router } from 'express'
import createError, { isHttpError } from 'http-errors'
import type { AppContext } from '../context.js'
import { resolveBlobSource } from './blob-resolver.js'

export function createRouter(ctx: AppContext): Router {
  const router = Router()

  router.get('/blob-source/:did/:cid', async (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    res.set('X-Content-Type-Options', 'nosniff')
    try {
      const source = await resolveBlobSource(
        ctx,
        req.params.did,
        req.params.cid,
      )
      res.json({ origin: source.origin })
    } catch (err) {
      next(
        isHttpError(err)
          ? err
          : createError(502, 'Upstream Error', { cause: err }),
      )
    }
  })

  return router
}
