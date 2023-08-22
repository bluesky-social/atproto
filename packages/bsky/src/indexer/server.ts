import express from 'express'
import { IndexerSubscription } from './subscription'

export type CloseFn = () => Promise<void>

export const createServer = (sub: IndexerSubscription): express.Application => {
  const app = express()
  app.post('/reprocess/:did', (req, res) => {
    sub.requestReprocess(req.params.did)
    res.send(200)
  })
  return app
}

export const startServer = (
  app: express.Application,
  port?: number,
): CloseFn => {
  const server = app.listen(port)
  return () => {
    return new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}
