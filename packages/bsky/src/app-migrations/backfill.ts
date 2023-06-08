import { Database as PdsDatabase } from '@atproto/pds'
import AppContext from '../context'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { WriteOpAction, cborToLexRecord } from '@atproto/repo'
import { cborDecode } from '@atproto/common'
import { def } from '@atproto/repo'

const PAGINATION_SIZE = 1000

const indexAccounts = async (ctx: AppContext, pdsDb: PdsDatabase) => {
  // @should we copy over user_account.createdAt for indexedAt time?
  const now = new Date().toISOString()

  // @TODO actor_sync table

  let lastDid: string | undefined
  /* eslint-disable */
  while (true) {
    let builder = pdsDb.db
      .selectFrom('did_handle')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.creator', '=', 'repo_root.did')
          .onRef('ipld_block.cid', '=', 'repo_root.root'),
      )
      .selectAll()
      .orderBy('did_handle.did', 'asc')
      .limit(PAGINATION_SIZE)
    if (lastDid) {
      builder = builder.where('did', '>', lastDid)
    }
    const page = await builder.execute()

    const actorVals = page.map((user) => ({
      did: user.did,
      handle: user.handle,
      indexedAt: now,
      takedownId: user.takedownId,
    }))
    await ctx.db.db.insertInto('actor').values(actorVals).execute()

    const actorSyncVals = page.map((user) => {
      const root = def.commit.schema.parse(cborDecode(user.content))
      return {
        did: user.did,
        commitCid: user.cid,
        commitDataCid: root.data.toString(),
        rebaseCount: 0,
        tooBigCount: 0,
      }
    })
    await ctx.db.db.insertInto('actor_sync').values(actorSyncVals).execute()

    lastDid = page.at(-1)?.did
    if (!lastDid) break
  }
}

const indexRecords = async (ctx: AppContext, pdsDb: PdsDatabase) => {
  const indexingSrvc = ctx.services.indexing(ctx.db)

  let lastDid: string | undefined
  let lastCid: string | undefined
  /* eslint-disable */
  while (true) {
    let builder = pdsDb.db
      .selectFrom('record')
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('record.did', '=', 'ipld_block.creator')
          .onRef('record.cid', '=', 'ipld_block.cid'),
      )
      .selectAll()
      .orderBy('record.did', 'asc')
      .orderBy('record.cid', 'asc')
      .limit(PAGINATION_SIZE)

    if (lastDid && lastCid) {
      builder = builder
        .where('record.did', '>', lastDid)
        .orWhere((clause) =>
          clause
            .where('record.did', '=', lastDid ?? '')
            .where('record.cid', '>', lastCid ?? ''),
        )
    }
    const page = await builder.execute()

    await Promise.all(
      page.map((record) =>
        indexingSrvc.indexRecord(
          new AtUri(record.uri),
          CID.parse(record.cid),
          cborToLexRecord(record.content),
          WriteOpAction.Create,
          record.indexedAt,
        ),
      ),
    )
    lastDid = page.at(-1)?.did
    lastCid = page.at(-1)?.cid
    if (!lastDid || !lastCid) {
      break
    }
  }
}

const indexModerationActions = async (ctx: AppContext, pdsDb: PdsDatabase) => {
  const res = await pdsDb.db
    .selectFrom('moderation_action')
    .selectAll()
    .execute()

  await ctx.db.db.insertInto('moderation_action').values(res).execute()
}

const indexModerationActionSubjectBlobs = async (
  ctx: AppContext,
  pdsDb: PdsDatabase,
) => {
  const res = await pdsDb.db
    .selectFrom('moderation_action_subject_blob')
    .selectAll()
    .execute()

  // do we want to add recordUri to bsky table?
  const vals = res.map(({ actionId, cid }) => ({ actionId, cid }))

  await ctx.db.db
    .insertInto('moderation_action_subject_blob')
    .values(vals)
    .execute()
}

const indexModerationReports = async (ctx: AppContext, pdsDb: PdsDatabase) => {
  const res = await pdsDb.db
    .selectFrom('moderation_report')
    .selectAll()
    .execute()

  await ctx.db.db.insertInto('moderation_report').values(res).execute()
}

const indexModerationReportResolution = async (
  ctx: AppContext,
  pdsDb: PdsDatabase,
) => {
  const res = await pdsDb.db
    .selectFrom('moderation_report_resolution')
    .selectAll()
    .execute()

  await ctx.db.db
    .insertInto('moderation_report_resolution')
    .values(res)
    .execute()
}
