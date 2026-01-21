import { Router } from 'express'
import { AppContext } from '../context'
import * as aaApi from './age-assurance'
import * as kwsApi from './kws'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  if (ctx.kwsClient) {
    router.use('/kws', kwsApi.createRouter(ctx))
    router.use(aaApi.createRouter(ctx))
  }

  return router
}
