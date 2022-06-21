import express from 'express'
import cors from 'cors'
import KeyManagerDb from './db'
import * as crypto from '@adxp/crypto'

const runServer = (db: KeyManagerDb, port: number) => {
  const app = express()
  app.use(cors())

  app.use((_req, res, next) => {
    res.locals.db = db
    next()
  })

  // create root keypair
  // request ucan
  // request DID doc mutation

  app.post('/keypair', async (req, res) => {
    const keypair = await crypto.EcdsaKeypair.create()
    res.send(200)
  })

  app.get('/', async (req, res) => {
    res.send(200)
  })

  app.listen(port, () => {
    console.log(
      `🔑 Key management server is running at http://localhost:${port}`,
    )
  })
}
