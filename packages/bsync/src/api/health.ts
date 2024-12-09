import express from 'express'
import AppContext from '../context'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/_health', async function (_req, res) {
    res.send({ version: ctx.cfg.service.version })
  })

  return router
}
