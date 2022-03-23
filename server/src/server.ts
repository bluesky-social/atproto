import express from 'express'
import cors from 'cors'
import Routes from './routes/index.js'
import { IpldStore } from '@bluesky-demo/common'
import { Database } from './db/types.js'

const runServer = (blockstore: IpldStore, db: Database, port: number) => {
  const app = express()
  app.use(express.json())
  app.use(cors())

  app.use((_req, res, next) => {
    res.locals.blockstore = blockstore
    res.locals.db = db
    next()
  })

  app.use('/', Routes)

  app.listen(port, () => {
    console.log(`🐦 Bluesky server is running at http://localhost:${port}`)
  })
}

export default runServer
