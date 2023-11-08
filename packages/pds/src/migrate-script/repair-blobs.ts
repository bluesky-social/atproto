import dotenv from 'dotenv'
import * as ui8 from 'uint8arrays'
import AtpAgent from '@atproto/api'
import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'
import { getDb } from './db'
import { repairBlob } from './util'

dotenv.config()

export const runScript = async () => {
  const db = getDb()
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const adminToken = ui8.toString(
    ui8.fromString(`admin:${secrets.adminPassword}`, 'utf8'),
    'base64pad',
  )
  const pdsRes = await ctx.db.db.selectFrom('pds').selectAll().execute()
  const pdsInfos = pdsRes.map((row) => ({
    id: row.id,
    did: row.did,
    url: `https://${row.host}`,
    agent: new AtpAgent({ service: `https://${row.host}` }),
  }))
  const failed = await db
    .selectFrom('failed_blob')
    .innerJoin('status', 'status.did', 'failed_blob.did')
    .selectAll()
    .execute()
  let count = 0
  for (const blob of failed) {
    const pdsInfo = pdsInfos.find((info) => info.id === blob.pdsId)
    if (!pdsInfo) {
      throw new Error(`could not find pds with id: ${blob.pdsId}`)
    }
    try {
      await repairBlob(ctx, db, pdsInfo, blob.did, blob.cid, adminToken)
    } catch (err) {
      console.log(err)
    }
    count++
    console.log(`${count}/${failed.length}`)
  }
  console.log('DONE WITH ALL')
}

runScript()
