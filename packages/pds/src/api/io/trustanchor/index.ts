import { Router } from 'express'
import { AppContext } from '../../../context'
import quicklogin from './quicklogin'

export default function (ctx: AppContext): Router {
  const router = Router()

  // Mount QuickLogin routes under /io/trustanchor
  router.use(quicklogin(ctx))

  return router
}
