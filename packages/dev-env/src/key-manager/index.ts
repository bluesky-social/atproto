/**
 * NOTE
 * This key manager service is not meant for production use.
 * It's specifically designed for the dev env.
 */

import http from 'http'
import express from 'express'
import cors from 'cors'
import * as uint8arrays from 'uint8arrays'
import * as crypto from '@adxp/crypto'

import KeyManagerDb from './db.js'
import { formatDidWeb } from './did.js'

export const runServer = (db: KeyManagerDb, port: number): http.Server => {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.use((_req, res, next) => {
    res.locals.db = db
    next()
  })

  // request device ucan
  app.get('/ucan', async (req, res) => {
    res.send(200)
  })

  // create root keypair + DID
  app.post('/account', async (req, res) => {
    const { username, didServer } = req.body
    const didServerUrl = new URL(didServer)

    // create keypair
    const keypair = await crypto.EcdsaKeypair.create({ exportable: true })
    const pubKey58 = uint8arrays.toString(keypair.publicKey, 'base58btc')

    // create did doc
    const did = `did:web:${encodeURIComponent(didServerUrl.host)}:${username}`
    const didDoc = formatDidWeb(did, pubKey58)
    const didDocSignature = false // TODO

    // store and respond
    const db: KeyManagerDb = res.locals.db
    await db.put(did, keypair)
    await res.json({
      did,
      didKey: keypair.did(),
      didDoc,
      didDocSignature,
    })
  })

  // sign DID doc update
  app.post('/sign-did-doc-update/:did', async (req, res) => {
    res.json({
      did: req.params.did,
      didDoc: req.body,
      didDocSignature: false, // TODO
    })
  })

  return app.listen(port)
}

export default runServer
