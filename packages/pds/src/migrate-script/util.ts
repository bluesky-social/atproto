import fs from 'fs/promises'
import https from 'node:https'
import dotenv from 'dotenv'
import axios from 'axios'
import * as ui8 from 'uint8arrays'
import AtpAgent from '@atproto/api'
import AppContext from '../context'
import { FailedTakedown, MigrateDb, getDb } from './db'
import { CID } from 'multiformats/cid'
import { ServerSecrets, envToCfg, envToSecrets, readEnv } from '../config'
import SqlRepoStorage from '../sql-repo-storage'

export const httpClient = axios.create({
  timeout: 0, //optional
  httpsAgent: new https.Agent({ keepAlive: true }),
})

export type PdsInfo = {
  id: number
  did: string
  url: string
  agent: AtpAgent
}

export type AdminHeaders = {
  authorization: string
}

export const setupEnv = async () => {
  dotenv.config()
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
  return { db, ctx, adminHeaders, pdsInfos }
}

export const getPds = (infos: PdsInfo[], id: number | null): PdsInfo => {
  const pdsInfo = infos.find((info) => info.id === id)
  if (!pdsInfo) {
    throw new Error(`could not find pds with id: ${id}`)
  }
  return pdsInfo
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

export const doImport = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
  adminHeaders: AdminHeaders,
  since?: string,
) => {
  const revRes = await ctx.db.db
    .selectFrom('ipld_block')
    .select('repoRev')
    .where('creator', '=', did)
    .orderBy('repoRev', 'desc')
    .limit(1)
    .executeTakeFirst()
  const repoRev = revRes?.repoRev
  if (since && repoRev === since) {
    return
  }
  const storage = new SqlRepoStorage(ctx.db, did)
  const carStream = await storage.getCarStream(since)

  const importRes = await httpClient.post(
    `${pds.url}/xrpc/com.atproto.temp.importRepo`,
    carStream,
    {
      params: { did },
      headers: { 'content-type': 'application/vnd.ipld.car', ...adminHeaders },
      decompress: true,
      responseType: 'stream',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    },
  )

  let logOutput = ''
  for await (const log of importRes.data) {
    logOutput += log.toString()
    console.log(`${did}: ${log.toString()}`)
  }
  const lines = logOutput.split('\n')
  for (const line of lines) {
    if (line.includes('failed to import blob')) {
      const cid = line.split(':')[1].trim()
      await logFailedBlob(db, did, cid)
    }
  }
  return repoRev
}

const logFailedBlob = async (db: MigrateDb, did: string, cid: string) => {
  await db
    .insertInto('failed_blob')
    .values({ did, cid })
    .onConflict((oc) => oc.doNothing())
    .execute()
}

export const repairFailedPrefs = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
) => {
  const hasFailure = await db
    .selectFrom('failed_pref')
    .selectAll()
    .where('did', '=', did)
    .executeTakeFirst()
  if (hasFailure) {
    await repairPrefs(ctx, db, pds, did)
  }
}

export const repairPrefs = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
) => {
  const hasFailure = await db
    .selectFrom('failed_pref')
    .selectAll()
    .where('did', '=', did)
    .executeTakeFirst()
  if (!hasFailure) {
    return
  }
  await transferPreferences(ctx, pds, did)
  await db.deleteFrom('failed_pref').where('did', '=', did).execute()
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
  await repairBlobInternal(ctx, pds, did, cid, adminHeaders)
  await db
    .deleteFrom('failed_blob')
    .where('did', '=', did)
    .where('cid', '=', cid)
    .execute()
}

export const repairBlobInternal = async (
  ctx: AppContext,
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
    if (err?.['Code'] === 'NoSuchKey') {
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
}

export const getUserAccount = async (ctx: AppContext, did: string) => {
  const accountRes = await ctx.db.db
    .selectFrom('did_handle')
    .innerJoin('user_account', 'user_account.did', 'did_handle.did')
    .selectAll()
    .where('did_handle.did', '=', did)
    .executeTakeFirst()
  if (!accountRes) {
    throw new Error(`could not find account: ${did}`)
  }
  return accountRes
}

export const transferTakedowns = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
  adminHeaders: AdminHeaders,
) => {
  const [accountRes, takendownRecords, takendownBlobs] = await Promise.all([
    getUserAccount(ctx, did),
    ctx.db.db
      .selectFrom('record')
      .selectAll()
      .where('did', '=', did)
      .where('takedownRef', 'is not', null)
      .execute(),
    ctx.db.db
      .selectFrom('repo_blob')
      .selectAll()
      .where('did', '=', did)
      .where('takedownRef', 'is not', null)
      .execute(),
  ])
  const promises: Promise<unknown>[] = []
  if (accountRes.takedownRef) {
    const promise = pds.agent.com.atproto.admin
      .updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did,
          },
          takedown: {
            applied: true,
            ref: accountRes.takedownRef,
          },
        },
        {
          headers: adminHeaders,
          encoding: 'application/json',
        },
      )
      .catch(async (err) => {
        await logFailedTakedown(db, { did, err: err?.message })
      })
    promises.push(promise)
  }

  for (const takendownRecord of takendownRecords) {
    if (!takendownRecord.takedownRef) continue
    const promise = pds.agent.com.atproto.admin
      .updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: takendownRecord.uri,
            cid: takendownRecord.cid,
          },
          takedown: {
            applied: true,
            ref: takendownRecord.takedownRef,
          },
        },
        {
          headers: adminHeaders,
          encoding: 'application/json',
        },
      )
      .catch(async (err) => {
        await logFailedTakedown(db, {
          did,
          recordUri: takendownRecord.uri,
          recordCid: takendownRecord.cid,
          err: err?.message,
        })
      })
    promises.push(promise)
  }

  for (const takendownBlob of takendownBlobs) {
    if (!takendownBlob.takedownRef) continue
    const promise = pds.agent.com.atproto.admin
      .updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoBlobRef',
            did,
            cid: takendownBlob.cid,
            recordUri: takendownBlob.recordUri,
          },
          takedown: {
            applied: true,
            ref: takendownBlob.takedownRef,
          },
        },
        {
          headers: adminHeaders,
          encoding: 'application/json',
        },
      )
      .catch(async (err) => {
        await logFailedTakedown(db, {
          did,
          blobCid: takendownBlob.cid,
          err: err?.message,
        })
      })

    promises.push(promise)
  }

  await Promise.all(promises)
}

const logFailedTakedown = async (db: MigrateDb, takedown: FailedTakedown) => {
  await db
    .insertInto('failed_takedown')
    .values(takedown)
    .onConflict((oc) => oc.doNothing())
    .execute()
}

export const checkBorked = async (ctx: AppContext, did: string) => {
  try {
    const data = await ctx.plcClient.getDocumentData(did)
    const endpoint = data.services['atproto_pds'].endpoint
    if (endpoint !== 'https://bsky.social') {
      await fs.appendFile('borked_dids.tx', `${did}\n`)
    }
  } catch {
    // noop
  }
}
