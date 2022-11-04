import express from 'express'
import { sql } from 'kysely'
import * as locals from '../locals'

export const router = express.Router()

router.get('/xrpc/_health', async function (_req, res) {
  const { db, config, logger } = locals.get(res)
  const { version } = config
  try {
    await sql`select 1`.execute(db.db)
  } catch (err) {
    logger.error(err, 'failed health check')
    return res.status(503).send({ version, error: 'Service Unavailable' })
  }
  res.send({ version })
})
