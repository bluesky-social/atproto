import dotenv from 'dotenv'
import axios from 'axios'
import * as ui8 from 'uint8arrays'
import AtpAgent from '@atproto/api'
import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'
import { MigrateDb, getDb } from './db'
import { CID } from 'multiformats/cid'

dotenv.config()

type PdsInfo = {
  id: number
  did: string
  url: string
  agent: AtpAgent
}

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
    await repairBlob(ctx, db, pdsInfo, blob.did, blob.cid, adminToken)
    count++
    console.log(`${count}/${failed.length}`)
  }
  console.log('DONE WITH ALL')
}

const repairBlob = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
  cid: string,
  adminToken: string,
) => {
  const blob = await ctx.db.db
    .selectFrom('blob')
    .where('cid', '=', cid)
    .selectAll()
    .executeTakeFirst()
  if (!blob) return
  const blobStream = await ctx.blobstore.getStream(CID.parse(blob.cid))
  try {
    await axios.post(`${pds.url}/xrpc/com.atproto.temp.pushBlob`, blobStream, {
      params: { did },
      headers: {
        'content-type': blob.mimeType,
        authorization: `Basic ${adminToken}`,
      },
      decompress: true,
      responseType: 'stream',
    })
    await db
      .deleteFrom('failed_blob')
      .where('did', '=', did)
      .where('cid', '=', blob.cid)
      .execute()
  } catch (err) {
    console.log('failed: ', err)
  }
}

runScript()
