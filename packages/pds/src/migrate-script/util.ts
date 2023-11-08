import axios from 'axios'
import * as ui8 from 'uint8arrays'
import AtpAgent from '@atproto/api'
import AppContext from '../context'
import { MigrateDb } from './db'
import { CID } from 'multiformats/cid'
import { ServerSecrets } from '../config'

export type PdsInfo = {
  id: number
  did: string
  url: string
  agent: AtpAgent
}

export type AdminHeaders = {
  authorization: string
}

export const makeAdminHeaders = (secrets: ServerSecrets): AdminHeaders => {
  const adminToken = ui8.toString(
    ui8.fromString(`admin:${secrets.adminPassword}`, 'utf8'),
    'base64pad',
  )
  return {
    authorization: `Basic ${adminToken}`,
  }
}

export const transferPreferences = async (
  ctx: AppContext,
  pds: PdsInfo,
  did: string,
) => {
  const accessToken = await ctx.services
    .auth(ctx.db)
    .createAccessToken({ did: did, pdsDid: pds.did })

  const prefs = await ctx.services.account(ctx.db).getPreferences(did)
  await pds.agent.api.app.bsky.actor.putPreferences(
    { preferences: prefs },
    {
      headers: { authorization: `Bearer ${accessToken}` },
      encoding: 'application/json',
    },
  )
}

export const repairBlob = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
  cid: string,
  adminHeaders: AdminHeaders,
) => {
  const blob = await ctx.db.db
    .selectFrom('blob')
    .where('cid', '=', cid)
    .where('creator', '=', did)
    .selectAll()
    .executeTakeFirst()
  if (!blob) return
  let blobStream
  try {
    blobStream = await ctx.blobstore.getStream(CID.parse(blob.cid))
  } catch (err) {
    const hasTakedown = await ctx.db.db
      .selectFrom('repo_blob')
      .where('did', '=', did)
      .where('cid', '=', cid)
      .where('takedownRef', 'is not', null)
      .executeTakeFirst()
    if (hasTakedown) {
      return
    }
    throw err
  }
  await axios.post(`${pds.url}/xrpc/com.atproto.temp.pushBlob`, blobStream, {
    params: { did },
    headers: {
      'content-type': blob.mimeType,
      ...adminHeaders,
    },
    decompress: true,
    responseType: 'stream',
  })
  await db
    .deleteFrom('failed_blob')
    .where('did', '=', did)
    .where('cid', '=', blob.cid)
    .execute()
}
