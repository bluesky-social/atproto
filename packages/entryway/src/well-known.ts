import express from 'express'
import AppContext from './context'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/.well-known/atproto-did', async function (req, res) {
    const handle = req.hostname
    const supportedHandle = ctx.cfg.identity.serviceHandleDomains.some(
      (host) => handle.endsWith(host) || handle === host.slice(1),
    )
    if (!supportedHandle) {
      return res.status(404).send('User not found')
    }
    let did: string | undefined
    try {
      const user = await ctx.services.account(ctx.db).getAccount(handle, true)
      did = user?.did
    } catch (err) {
      return res.status(500).send('Internal Server Error')
    }
    if (!did) {
      return res.status(404).send('User not found')
    }
    res.type('text/plain').send(did)
  })

  return router
}
