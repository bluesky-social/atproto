import express from 'express'
import { IndexerSubscription } from './subscription'
import { IndexerConfig } from './config'
import { randomIntFromSeed } from '@atproto/crypto'

export type CloseFn = () => Promise<void>

export const createServer = (
  sub: IndexerSubscription,
  cfg: IndexerConfig,
): express.Application => {
  const app = express()
  app.post('/reprocess/:did', async (req, res) => {
    const did = req.params.did
    try {
      const partition = await randomIntFromSeed(did, cfg.ingesterPartitionCount)
      const supportedPartition = cfg.indexerPartitionIds.includes(partition)
      if (!supportedPartition) {
        return res.status(400).send(`unsupported partition: ${partition}`)
      }
    } catch (err) {
      return res.status(500).send('could not calculate partition')
    }
    await sub.requestReprocess(req.params.did)
    res.sendStatus(200)
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
