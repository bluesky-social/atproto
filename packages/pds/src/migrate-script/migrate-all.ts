import assert from 'node:assert'
import * as plcLib from '@did-plc/lib'
import SqlRepoStorage from '../sql-repo-storage'
import { createDeferrable } from '@atproto/common'
import AppContext from '../context'
import { MigrateDb, Status, TransferPhase } from './db'
import PQueue from 'p-queue'
import {
  AdminHeaders,
  PdsInfo,
  checkBorked,
  doImport,
  getPds,
  getUserAccount,
  httpClient,
  repairBlob,
  repairFailedPrefs,
  setupEnv,
  transferPreferences,
  transferTakedowns,
} from './util'

export const runScript = async () => {
  console.log('starting')
  const { db, ctx, adminHeaders, pdsInfos } = await setupEnv()

  const pdsIds = process.argv[2].split(',').map((id) => parseInt(id))

  const todo = await db
    .selectFrom('status')
    .where('status.phase', '<', 7)
    .where('pdsId', 'in', pdsIds)
    .orderBy('phase', 'desc')
    .orderBy('did')
    .selectAll()
    .execute()

  let pdsCounter = 0
  let completed = 0
  let failed = 0

  console.log('migrating: ', todo.length)

  const migrateQueue = new PQueue({ concurrency: 80 })
  process.on('SIGINT', async () => {
    migrateQueue.clear()
    console.log(`waiting on ${migrateQueue.pending} to finish`)
    await migrateQueue.onIdle()
    process.exit(0)
  })

  for (const status of todo) {
    if (!status.pdsId) {
      status.pdsId = pdsInfos[pdsCounter % pdsInfos.length].id
      pdsCounter++
    }
    const pdsInfo = getPds(pdsInfos, status.pdsId)
    migrateQueue.add(async () => {
      try {
        await migrateRepo(ctx, db, pdsInfo, status, adminHeaders)
        await db
          .updateTable('status')
          .set({ failed: 0, err: null })
          .where('did', '=', status.did)
          .execute()
        completed++
        await repairFailedPrefs(ctx, db, pdsInfo, status.did).catch(() =>
          console.log('failed to repair prefs: ', status.did),
        )
        repairFailedBlobs(ctx, db, pdsInfo, status.did, adminHeaders).catch(
          () => console.log('failed to repair blobs: ', status.did),
        )
      } catch (err) {
        // @ts-ignore
        const errmsg: string = err?.message ?? null
        console.log(err)
        await db
          .updateTable('status')
          .set({ failed: 1, err: errmsg })
          .where('did', '=', status.did)
          .execute()
        failed++

        // check if the did is caught in a bad state where migration failed but plc got updated
        await checkBorked(ctx, status.did)
      }
      console.log(`completed: ${completed}, failed: ${failed}`)
    })
  }
  await migrateQueue.onIdle()
  console.log('DONE WITH ALL')
}

const migrateRepo = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  status: Status,
  adminHeaders: AdminHeaders,
) => {
  if (status.phase < TransferPhase.reservedKey) {
    const signingKey = await reserveSigningKey(pds, status.did)
    status.signingKey = signingKey
    status.phase = TransferPhase.reservedKey
    await updateStatus(db, status)
  }

  if (status.phase < TransferPhase.initImport) {
    const importedRev = await doImport(ctx, db, pds, status.did, adminHeaders)
    if (importedRev) {
      status.importedRev = importedRev
    }
    status.phase = TransferPhase.initImport
    await updateStatus(db, status)
  }

  if (status.phase < TransferPhase.transferredPds) {
    const importedRev = await lockAndTransfer(
      ctx,
      db,
      pds,
      status,
      adminHeaders,
    )
    status.importedRev = importedRev
    status.phase = TransferPhase.transferredPds
    await updateStatus(db, status)
  }

  if (status.phase < TransferPhase.transferredEntryway) {
    await updatePdsOnEntryway(ctx, pds, status.did)
    status.phase = TransferPhase.transferredEntryway
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
        .execute()
    } finally {
      status.phase = TransferPhase.preferences
      await updateStatus(db, status)
    }
  }

  if (status.phase < TransferPhase.takedowns) {
    await transferTakedowns(ctx, db, pds, status.did, adminHeaders)
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

const lockAndTransfer = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  status: Status,
  adminHeaders: AdminHeaders,
) => {
  const repoLockedDefer = createDeferrable()
  const transferDefer = createDeferrable()
  let txFinished = false
  ctx.db
    .transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, status.did)
      await storage.lockRepo()
      repoLockedDefer.resolve()
      await transferDefer.complete
    })
    .catch((err) => {
      console.error(`error in repo lock tx for did: ${status.did}`, err)
      txFinished = true
    })

  await repoLockedDefer.complete

  let importedRev
  try {
    importedRev = await doImport(
      ctx,
      db,
      pds,
      status.did,
      adminHeaders,
      status.importedRev ?? undefined,
    )

    let plcOp
    if (status.did.startsWith('did:web')) {
      plcOp = {}
    } else {
      const lastOp = await ctx.plcClient.getLastOp(status.did)
      if (!lastOp || lastOp.type === 'plc_tombstone') {
        throw new Error('could not find last plc op')
      }
      plcOp = await plcLib.createUpdateOp(
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
    }
    assert(!txFinished)
    const accountRes = await getUserAccount(ctx, status.did)
    await httpClient.post(
      `${pds.url}/xrpc/com.atproto.temp.transferAccount`,
      {
        did: status.did,
        handle: accountRes.handle,
        plcOp,
      },
      { headers: adminHeaders },
    )

    return importedRev
  } finally {
    transferDefer.resolve()
  }
}

const updatePdsOnEntryway = async (
  ctx: AppContext,
  pds: PdsInfo,
  did: string,
) => {
  await ctx.db.transaction(async (dbTxn) => {
    await dbTxn.db
      .updateTable('user_account')
      .where('did', '=', did)
      .set({ pdsId: pds.id })
      .execute()
    await dbTxn.db
      .updateTable('repo_root')
      .where('did', '=', did)
      .set({ did: `migrated-${did}` })
      .execute()
  })
}

const repairFailedBlobs = async (
  ctx: AppContext,
  db: MigrateDb,
  pds: PdsInfo,
  did: string,
  adminHeaders: AdminHeaders,
) => {
  const failedBlobs = await db
    .selectFrom('failed_blob')
    .where('did', '=', did)
    .selectAll()
    .execute()
  for (const blob of failedBlobs) {
    try {
      await repairBlob(ctx, db, pds, did, blob.cid, adminHeaders)
    } catch {
      console.log(`failed blob: ${did} ${blob.cid}`)
    }
  }
}

runScript()
