import dotenv from 'dotenv'
import AtpAgent from '@atproto/api'
import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'
import { getDb } from './db'
import { makeAdminHeaders, repairBlob } from './util'

dotenv.config()

export const runScript = async () => {
  const db = getDb()
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const adminHeaders = makeAdminHeaders(secrets)
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
      await repairBlob(ctx, db, pdsInfo, blob.did, blob.cid, adminHeaders)
    } catch (err) {
      console.log(err?.['message'])
      console.log(err?.['code'])
    }
    count++
    console.log(`${count}/${failed.length}`)
  }
  console.log('DONE WITH ALL')
}

runScript()
