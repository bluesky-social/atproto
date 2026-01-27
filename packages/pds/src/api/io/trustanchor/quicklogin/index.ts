import { Router } from 'express'
import express from 'express'
import { AppContext } from '../../../../context'
import { initQuickLogin } from './init'
import { callbackQuickLogin } from './callback'
import { statusQuickLogin } from './status'

export default function (ctx: AppContext): Router {
  const router = Router()

  // Add JSON body parser for this router
  router.use(express.json())

  // Only register if QuickLogin is enabled
  if (!ctx.cfg.quicklogin) {
    return router
  }

  // Register all QuickLogin endpoints
  initQuickLogin(router, ctx)
  callbackQuickLogin(router, ctx)
  statusQuickLogin(router, ctx)

  return router
}
