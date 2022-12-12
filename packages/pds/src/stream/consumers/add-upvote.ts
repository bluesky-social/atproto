import { sql } from 'kysely'
import { TID } from '@atproto/common'
import Database from '../../db'
import * as repo from '../../repo'
import * as lexicons from '../../lexicon/lexicons'
import { Consumer } from '../types'
import { AddUpvote } from '../messages'
import { AuthStore } from '@atproto/auth'
type GetAuthStoreFn = (did: string) => AuthStore

export default class extends Consumer<AddUpvote> {
  constructor(private getAuthStore: GetAuthStoreFn) {
    super()
  }

  async dispatch(ctx: { db: Database; message: AddUpvote }) {
    const { db, message } = ctx
    const userScenes = await db.getScenesForUser(message.user)
    if (userScenes.length < 1) return
    const updated = await db.db
      .updateTable('scene_votes_on_post')
      .set({ count: sql`count + 1` })
      .where('subject', '=', message.subject)
      .where('did', 'in', userScenes)
      .returningAll()
      .execute()
    const updatedIds = updated.map((row) => row.did)
    const toInsert = userScenes.filter((scene) => updatedIds.indexOf(scene) < 0)
    if (toInsert.length > 0) {
      await db.db
        .insertInto('scene_votes_on_post')
        .values(
          toInsert.map((scene) => ({
            did: scene,
            subject: message.subject,
            count: 1,
            postedTrending: 0 as 0 | 1,
          })),
        )
        .execute()
    }
    await this.checkTrending(db, userScenes, message.subject)
  }

  // Side effects
  // -------------
  private async checkTrending(
    db: Database,
    scenes: string[],
    subject: string,
  ): Promise<void> {
    if (scenes.length === 0) return
    const state = await db.db
      .selectFrom('scene_member_count as members')
      .innerJoin('scene_votes_on_post as votes', 'votes.did', 'members.did')
      .innerJoin('post', 'post.uri', 'votes.subject')
      .where('members.did', 'in', scenes)
      .where('votes.subject', '=', subject)
      .select([
        'members.did as did',
        'members.count as memberCount',
        'votes.subject as subject',
        'post.cid as subjectCid',
        'votes.count as voteCount',
        'votes.postedTrending as postedTrending',
      ])
      .execute()

    const now = new Date().toISOString()
    await Promise.all(
      state.map(async (scene) => {
        if (scene.postedTrending) return
        const ratio =
          scene.memberCount !== 0 ? scene.voteCount / scene.memberCount : 0
        const shouldTrend = scene.voteCount > 1 && ratio >= 0.2
        if (!shouldTrend) return

        // this is a "threshold vote" that makes the post trend
        const sceneAuth = this.getAuthStore(scene.did)
        const writes = await repo.prepareWrites(scene.did, {
          action: 'create',
          collection: lexicons.ids.AppBskyFeedTrend,
          rkey: TID.nextStr(),
          value: {
            subject: {
              uri: scene.subject,
              cid: scene.subjectCid,
            },
            createdAt: now,
          },
        })
        const setTrendPosted = db.db
          .updateTable('scene_votes_on_post')
          .set({ postedTrending: 1 })
          .where('did', '=', scene.did)
          .where('subject', '=', scene.subject)
          .execute()

        await Promise.all([
          repo.writeToRepo(db, scene.did, sceneAuth, writes, now),
          repo.indexWrites(db, writes, now),
          setTrendPosted,
        ])
      }),
    )
  }
}
