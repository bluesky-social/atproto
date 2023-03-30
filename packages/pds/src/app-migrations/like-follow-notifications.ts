import assert from 'assert'
import { sql } from 'kysely'
import AppContext from '../context'
import Database from '../db'
import { appMigration } from '../db/leader'
import { ids } from '../lexicon/lexicons'
import { countAll } from '../db/util'

const MIGRATION_NAME = '2023-03-29-like-follow-notifications'
const SHORT_NAME = 'like-follow-notifications'
const VOTE_LEX_ID = 'app.bsky.feed.vote'
const TREND_LEX_ID = 'app.bsky.feed.trend'
const ASSERTION_LEX_ID = 'app.bsky.graph.assertion'

// @NOTE must run after update-follow-subjects and votes-to-likes

export async function likeFollowNotificationsMigration(ctx: AppContext) {
  await appMigration(ctx.db, MIGRATION_NAME, (tx) => main(tx, ctx))
}

async function main(tx: Database, _ctx: AppContext) {
  console.log(SHORT_NAME, 'beginning')
  tx.assertTransaction()
  const { ref } = tx.db.dynamic
  const now = new Date().toISOString()

  // Remove scene-related notifications
  console.log(SHORT_NAME, 'removing notifications related to scenes')

  const removedSceneNotifs = await tx.db
    .deleteFrom('user_notification')
    .where('recordUri', 'like', `%/${TREND_LEX_ID}/%`)
    .orWhere('recordUri', 'like', `%/${ASSERTION_LEX_ID}/%`)
    .executeTakeFirst()

  console.log(
    SHORT_NAME,
    `removed ${Number(
      removedSceneNotifs.numDeletedRows,
    )} notifications for trends and assertions`,
  )

  // Updating uris in index
  console.log(SHORT_NAME, 'updating uris for like notifications')

  // Update uris for votes in notifications to likes
  const updatedLikeUris = await tx.db
    .updateTable('user_notification')
    .where('reason', '=', 'vote')
    .set({
      reason: 'like',
      recordUri: sql`replace("recordUri", ${`/${VOTE_LEX_ID}/`}, ${`/${ids.AppBskyFeedLike}/`})`,
    })
    .executeTakeFirst()

  console.log(
    SHORT_NAME,
    `updated ${Number(
      updatedLikeUris.numUpdatedRows,
    )} like uris in notifications`,
  )

  // Update cids for like and follow records in notifications
  console.log(SHORT_NAME, 'updating cids for like and follow notifications')

  const recordForLikeOrFollowQb = tx.db
    .selectFrom('record')
    .where('collection', 'in', [ids.AppBskyFeedLike, ids.AppBskyGraphFollow])
    .whereRef('uri', '=', ref('user_notification.recordUri'))
  const updatedCids = await tx.db
    .updateTable('user_notification')
    .whereExists(recordForLikeOrFollowQb.selectAll())
    .set({
      recordCid: recordForLikeOrFollowQb.select('cid'),
    })
    .executeTakeFirst()

  console.log(
    SHORT_NAME,
    `updated ${Number(
      updatedCids.numUpdatedRows,
    )} like and follow cids in notifications`,
  )

  console.log(SHORT_NAME, 'running dummy check')
  await dummyCheck(tx)

  console.log(
    SHORT_NAME,
    'complete in',
    (Date.now() - Date.parse(now)) / 1000,
    'sec',
  )
}

async function dummyCheck(db: Database) {
  // Check 1. ensure no notifications left hanging around for votes, trends, assertions

  const { lingeringNotifications } = await db.db
    .selectFrom('user_notification')
    .where('recordUri', 'like', `%/${VOTE_LEX_ID}/%`)
    .orWhere('recordUri', 'like', `%/${TREND_LEX_ID}/%`)
    .orWhere('recordUri', 'like', `%/${ASSERTION_LEX_ID}/%`)
    .select(countAll.as('lingeringNotifications'))
    .executeTakeFirstOrThrow()
  assert(
    lingeringNotifications === 0,
    `${SHORT_NAME} dummy check failed: ${lingeringNotifications} lingering notifications`,
  )

  // Check 2. ensure notification cids for likes and follows match the records

  const { notifsMismatchedCount } = await db.db
    .selectFrom('user_notification')
    .innerJoin('record', 'record.uri', 'user_notification.recordUri')
    .where('collection', 'in', [ids.AppBskyFeedLike, ids.AppBskyGraphFollow])
    .whereRef('user_notification.recordCid', '!=', 'record.cid')
    .select(countAll.as('notifsMismatchedCount'))
    .executeTakeFirstOrThrow()
  assert(
    notifsMismatchedCount === 0,
    `${SHORT_NAME} dummy check failed: ${notifsMismatchedCount} mismatched like and follow cids in notifications`,
  )
}
