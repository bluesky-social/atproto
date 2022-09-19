import express from 'express'
import { check } from '@adxp/common'
import * as document from '../lib/document'
import * as t from '../lib/types'
import * as locals from './locals'
import { ServerError } from './error'

const router = express.Router()

// Get a DID doc
router.get(`/:did`, async function (req, res) {
  const { did } = req.params
  const { db } = locals.get(res)
  const log = await db.opsForDid(did)
  if (log.length === 0) {
    throw new ServerError(404, `DID not registered: ${did}`)
  }
  const doc = await document.validateOperationLog(did, log)
  res.send(doc)
})

// Get operation log for a DID
router.get(`/log/:did`, async function (req, res) {
  const { did } = req.params
  const { db } = locals.get(res)
  const log = await db.opsForDid(did)
  if (log.length === 0) {
    throw new ServerError(404, `DID not registered: ${did}`)
  }
  res.send({ log })
})

// Update or create a DID doc
router.post(`/:did`, async function (req, res) {
  const { did } = req.params
  const op = req.body
  if (!check.is(op, t.def.operation)) {
    throw new Error('Not a valid operation')
  }
  const { db } = locals.get(res)
  await db.validateAndAddOp(did, op)
  res.sendStatus(200)
})

export default router
