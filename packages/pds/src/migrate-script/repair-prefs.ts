import dotenv from 'dotenv'
import AtpAgent from '@atproto/api'
import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'
import { getDb } from './db'
import { transferPreferences } from './util'

dotenv.config()

export const runScript = async () => {
  const db = getDb()
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const pdsRes = await ctx.db.db.selectFrom('pds').selectAll().execute()
  const pdsInfos = pdsRes.map((row) => ({
    id: row.id,
    did: row.did,
    url: `https://${row.host}`,
    agent: new AtpAgent({ service: `https://${row.host}` }),
  }))
  const failed = await db
    .selectFrom('failed_pref')
    .innerJoin('status', 'status.did', 'failed_pref.did')
    .selectAll()
    .execute()
  let count = 0
  for (const pref of failed) {
    const pdsInfo = pdsInfos.find((info) => info.id === pref.pdsId)
    if (!pdsInfo) {
      throw new Error(`could not find pds with id: ${pref.pdsId}`)
    }
    try {
      await transferPreferences(ctx, pdsInfo, pref.did)
      await db.deleteFrom('failed_pref').where('did', '=', pref.did).execute()
    } catch (err) {
      console.log(err)
    }
    count++
    console.log(`${count}/${failed.length}`)
  }
  console.log('DONE WITH ALL')
}

runScript()
