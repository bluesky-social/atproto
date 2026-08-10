import { Router } from 'express'
import type { AppContext } from '../context.js'
import * as aaApi from './age-assurance/index.js'
import * as kwsApi from './kws/index.js'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  if (ctx.kwsClient) {
    router.use('/kws', kwsApi.createRouter(ctx))
    router.use(aaApi.createRouter(ctx))
  }

  return router
}
