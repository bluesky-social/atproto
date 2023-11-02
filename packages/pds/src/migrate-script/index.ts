import axios from 'axios'
import * as ui8 from 'uint8arrays'
import AtpAgent from '@atproto/api'
import * as plcLib from '@did-plc/lib'
import SqlRepoStorage from '../sql-repo-storage'
import { createDeferrable } from '@atproto/common'
import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'
import { FailedTakedown, MigrateDb, Status, TransferPhase, getDb } from './db'

type PdsInfo = {
  id: number
  did: string
  url: string
  agent: AtpAgent
}

export const runScript = async () => {
  const db = await getDb('/data/migrate.db')
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
  const todo = await db
    .selectFrom('status')
    .where('status.phase', '=', 0)
    .where('failed', '!=', 1)
    .selectAll()
    .execute()
  let pdsCounter = 0
  for (const status of todo) {
    let pdsId = status.pdsId
    if (!pdsId) {
      pdsId = pdsCounter % pdsInfos.length
      pdsCounter++
    }
    const pdsInfo = pdsInfos[pdsId]
    try {
      await migrateRepo(ctx, db, pdsInfo, status, adminToken)
      console.log(`completed migrating: ${status.did}`)
    } catch (err) {
      await db
        .updateTable('status')
        .set({ failed: 1 })
        .where('did', '=', status.did)
      console.error(`failed to migrate: ${status.did}`, err)
    }
    pdsCounter++
  }
  console.log('DONE WITH ALL')
}

const migrateRepo = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  status: Status,
  adminToken: string,
) => {
  if (status.phase < TransferPhase.reservedKey) {
    const signingKey = await reserveSigningKey(pds, status.did)
    status.signingKey = signingKey
    status.phase = TransferPhase.reservedKey
    await updateStatus(db, status)
  }

  if (status.phase < TransferPhase.initImport) {
    const importedRev = await doImport(ctx, db, pds, status.did)
    if (importedRev) {
      status.importedRev = importedRev
    }
    status.phase = TransferPhase.initImport
    await updateStatus(db, status)
  }

  if (status.phase < TransferPhase.transferred) {
    const importedRev = await lockAndTransfer(ctx, db, pds, status)
    status.importedRev = importedRev
    status.phase = TransferPhase.transferred
    await updateStatus(db, status)
  }

  if (status.phase < TransferPhase.preferences) {
    try {
      await transferPreferences(ctx, pds, status.did)
    } catch (err) {
      await db
        .insertInto('failed_pref')
        .values({ did: status.did })
        .onConflict((oc) => oc.doNothing())
    } finally {
      status.phase = TransferPhase.preferences
      await updateStatus(db, status)
    }
  }

  if (status.phase < TransferPhase.takedowns) {
    await transferTakedowns(ctx, db, pds, status.did, adminToken)
    status.phase = TransferPhase.completed
    await updateStatus(db, status)
  }
}

const updateStatus = async (db: MigrateDb, status: Status) => {
  return db
    .updateTable('status')
    .set({ ...status })
    .where('did', '=', status.did)
    .execute()
}

const reserveSigningKey = async (
  pds: PdsInfo,
  did: string,
): Promise<string> => {
  const signingKeyRes =
    await pds.agent.api.com.atproto.server.reserveSigningKey({ did })
  return signingKeyRes.data.signingKey
}

const doImport = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
  since?: string,
) => {
  const storage = new SqlRepoStorage(ctx.db, did)
  const root = await storage.getRootDetailed()
  if (!root) {
    throw new Error(`repo not found: ${did}`)
  }
  if (since && root.rev === since) {
    return
  }
  const carStream = await storage.getCarStream(since)

  const importRes = await axios.post(
    `${pds.url}/xrpc/com.atproto.temp.importRepo`,
    carStream,
    {
      params: { did },
      headers: { 'content-type': 'application/vnd.ipld.car' },
      decompress: true,
      responseType: 'stream',
    },
  )

  for await (const log of importRes.data) {
    const lines = log.split('\n')
    for (const line of lines) {
      if (line.indexOf('failed to import blob') > 0) {
        const cid = line.split(':')[1].trim()
        await logFailedBlob(db, did, cid)
      }
    }
    console.log(`import update for ${did}: `, log.toString())
  }
  return root.rev
}

const lockAndTransfer = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  status: Status,
) => {
  const defer = createDeferrable()
  ctx.db
    .transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, status.did)
      await storage.lockRepo()
      await defer.complete
    })
    .catch((err) => {
      console.error(`error in repo lock tx for did: ${status.did}`, err)
    })

  let importedRev
  try {
    importedRev = await doImport(
      ctx,
      db,
      pds,
      status.did,
      status.importedRev ?? undefined,
    )

    const lastOp = await ctx.plcClient.getLastOp(status.did)
    if (!lastOp || lastOp.type === 'plc_tombstone') {
      throw new Error('could not find last plc op')
    }
    const plcOp = await plcLib.createUpdateOp(
      lastOp,
      ctx.plcRotationKey,
      (normalized) => {
        if (!status.signingKey) {
          throw new Error('no reserved signing key')
        }
        return {
          ...normalized,
          verificationMethods: {
            atproto: status.signingKey,
          },
          services: {
            atproto_pds: {
              type: 'AtprotoPersonalDataServer',
              endpoint: pds.url,
            },
          },
        }
      },
    )

    const accountRes = await getUserAccount(ctx, status.did)
    await axios.post(`${pds.url}/xrpc/com.atproto.temp.transferAccount`, {
      did: status.did,
      handle: accountRes.handle,
      plcOp,
    })

    defer.resolve()

    await ctx.db.db
      .updateTable('user_account')
      .where('did', '=', status.did)
      .set({ pdsId: pds.id })
      .execute()
    await ctx.db.db
      .updateTable('repo_root')
      .where('did', '=', status.did)
      .set({ did: `migrated-${status.did}` })
      .execute()
    return importedRev
  } finally {
    defer.resolve()
  }
}

const transferPreferences = async (
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

const logFailedBlob = async (db: MigrateDb, did: string, cid: string) => {
  await db
    .insertInto('failed_blob')
    .values({ did, cid })
    .onConflict((oc) => oc.doNothing())
    .execute()
}

const logFailedTakedown = async (db: MigrateDb, takedown: FailedTakedown) => {
  await db
    .insertInto('failed_takedown')
    .values(takedown)
    .onConflict((oc) => oc.doNothing())
    .execute()
}

const transferTakedowns = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
  adminToken: string,
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
          headers: { authorization: `Basic ${adminToken}` },
          encoding: 'application/json',
        },
      )
      .catch(async () => {
        await logFailedTakedown(db, { did })
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
          headers: { authorization: `Basic ${adminToken}` },
          encoding: 'application/json',
        },
      )
      .catch(async () => {
        await logFailedTakedown(db, {
          did,
          recordUri: takendownRecord.uri,
          recordCid: takendownRecord.cid,
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
          headers: { authorization: `Basic ${adminToken}` },
          encoding: 'application/json',
        },
      )
      .catch(async () => {
        await logFailedTakedown(db, {
          did,
          blobCid: takendownBlob.cid,
        })
      })

    promises.push(promise)
  }

  await Promise.all(promises)
}

const getUserAccount = async (ctx: AppContext, did: string) => {
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
