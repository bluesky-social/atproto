import express from 'express'
import { sql } from 'kysely'
import { check } from '@atproto/common'
import * as document from '../lib/document'
import * as t from '../lib/types'
import * as locals from './locals'
import { ServerError } from './error'

const router = express.Router()

router.get('/_health', async function (_req, res) {
  const { db, version, logger } = locals.get(res)
  try {
    await sql`select 1`.execute(db.db)
  } catch (err) {
    logger.error(err, 'failed health check')
    return res.status(503).send({ version, error: 'Service Unavailable' })
  }
  res.send({ version })
})

// Get data for a DID document
router.get('/:did', async function (req, res) {
  const { did } = req.params
  const { db } = locals.get(res)
  const log = await db.opsForDid(did)
  if (log.length === 0) {
    throw new ServerError(404, `DID not registered: ${did}`)
  }
  const data = await document.validateOperationLog(did, log)
  const doc = await document.formatDidDoc(data)
  res.type('application/did+ld+json')
  res.send(JSON.stringify(doc))
})

// Get data for a DID document
router.get('/data/:did', async function (req, res) {
  const { did } = req.params
  const { db } = locals.get(res)
  const log = await db.opsForDid(did)
  if (log.length === 0) {
    throw new ServerError(404, `DID not registered: ${did}`)
  }
  const data = await document.validateOperationLog(did, log)
  res.send(data)
})

// Get operation log for a DID
router.get('/log/:did', async function (req, res) {
  const { did } = req.params
  const { db } = locals.get(res)
  const log = await db.opsForDid(did)
  if (log.length === 0) {
    throw new ServerError(404, `DID not registered: ${did}`)
  }
  res.send({ log })
})

// Update or create a DID doc
router.post('/:did', async function (req, res) {
  const { did } = req.params
  const op = req.body
  if (!check.is(op, t.def.operation)) {
    throw new ServerError(400, `Not a valid operation: ${JSON.stringify(op)}`)
  }
  const { db } = locals.get(res)
  await db.validateAndAddOp(did, op)
  res.sendStatus(200)
})

export default router
