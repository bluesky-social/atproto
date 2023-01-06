import Database from '../../db'
import * as repo from '../../repo'
import * as lexicons from '../../lexicon/lexicons'
import { Consumer } from '../types'
import { SceneVotesOnPostTableUpdates } from '../messages'
import AppContext from '../../context'

export default class extends Consumer<SceneVotesOnPostTableUpdates> {
  constructor(public ctx: AppContext) {
    super()
  }

  async dispatch(ctx: { message: SceneVotesOnPostTableUpdates; db: Database }) {
    const { message, db } = ctx
    const { dids: scenes, subject } = message
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
        const sceneAuth = this.ctx.getAuthstore(scene.did)
        const write = await repo.prepareCreate({
          did: scene.did,
          collection: lexicons.ids.AppBskyFeedTrend,
          record: {
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

        const repoTxn = this.ctx.services.repo(db)

        await Promise.all([
          repoTxn.writeToRepo(scene.did, sceneAuth, [write], now),
          repoTxn.indexWrites([write], now),
          setTrendPosted,
        ])
      }),
    )
  }
}
