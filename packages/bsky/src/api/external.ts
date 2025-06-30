import { Router } from 'express'
import { AppContext } from '../context'
import * as kwsApi from './kws-api'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  if (ctx.ageAssuranceClient) {
    router.use('/kws', kwsApi.createRouter(ctx))
  }

  return router
}
