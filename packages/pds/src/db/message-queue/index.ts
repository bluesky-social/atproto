import { RepoStructure } from '@atproto/repo'
import Database from '..'
import {
  AddMember,
  AddUpvote,
  CreateNotification,
  DeleteNotifications,
  Message,
  RemoveMember,
  RemoveUpvote,
} from './messages'
import { sql } from 'kysely'
import { dbLogger as log } from '../../logger'
import { SceneVotesOnPost } from './tables/sceneVotesOnPost'
import { AuthStore } from '@atproto/auth'
import * as repoUtil from '../../util/repo'
import * as schema from '../../lexicon/schemas'
import { TID } from '@atproto/common'
import { MessageQueue } from '../types'

export class SqlMessageQueue implements MessageQueue {
  constructor(
    private db: Database,
    private getAuthStore: (did: string) => AuthStore,
  ) {}

  async send(messages: Message | Message[]): Promise<void> {
    const res = await this.db.db
      .insertInto('message_queue')
      .values({
        message: JSON.stringify(messages),
        read: 0,
        createdAt: new Date().toISOString(),
      })
      .returning('id')
      .execute()
    res.forEach((row) => this.process(row.id))
  }

  async catchup(): Promise<void> {
    let builder = this.db.db
      .selectFrom('message_queue')
      .where('read', '=', 0)
      .selectAll()
    if (this.db.dialect !== 'sqlite') {
      builder = builder.forUpdate()
    }
    const res = await builder.execute()
    await Promise.all(res.map((row) => this.process(row.id)))
  }

  private async process(id: number): Promise<void> {
    console.log('processing: ', id)
    await this.db.transaction(async (dbTxn) => {
      let builder = dbTxn.db
        .selectFrom('message_queue')
        .where('id', '=', id)
        .selectAll()
      if (this.db.dialect !== 'sqlite') {
        builder = builder.forUpdate()
      }

      const res = await builder.executeTakeFirst()

      if (!res) {
        log.error({ id }, 'message does not exist')
        return
      } else if (res.read === 1) return

      const message: Message = JSON.parse(res.message)
      await this.handleMessage(dbTxn, message)

      await dbTxn.db
        .updateTable('message_queue')
        .set({ read: 1 })
        .where('id', '=', id)
        .execute()
    })
  }

  private async handleMessage(db: Database, message: Message) {
    console.log('hadnling: ', message)
    switch (message.type) {
      case 'add_member':
        return this.handleAddMember(db, message)
      case 'remove_member':
        return this.handleRemoveMember(db, message)
      case 'add_upvote':
        return this.handleAddUpvote(db, message)
      case 'remove_upvote':
        return this.handleRemoveUpvote(db, message)
      case 'create_notification':
        return this.handleCreateNotification(db, message)
      case 'delete_notifications':
        return this.handleDeleteNotifications(db, message)
    }
  }

  // Reducers
  // -------------
  private async handleAddMember(
    db: Database,
    message: AddMember,
  ): Promise<void> {
    const res = await db.db
      .updateTable('scene_member_count')
      .set({ count: sql`count + 1` })
      .where('did', '=', message.scene)
      .returning(['did', 'count'])
      .execute()
    if (res.length === 0) {
      await db.db
        .insertInto('scene_member_count')
        .values({ did: message.scene, count: 0 })
        .execute()
    }
  }

  private async handleRemoveMember(
    db: Database,
    message: RemoveMember,
  ): Promise<void> {
    await db.db
      .updateTable('scene_member_count')
      .set({ count: sql`count - 1` })
      .where('did', '=', message.scene)
      .returning(['did', 'count'])
      .execute()
  }

  private async handleAddUpvote(
    db: Database,
    message: AddUpvote,
  ): Promise<void> {
    const userScenes = await db.getScenesForUser(message.user)

    const res = await db.db
      .updateTable('scene_votes_on_post')
      .set({ count: sql`count + 1` })
      .where('subject', '=', message.subject)
      .where('did', 'in', userScenes)
      .returning(['did', 'count', 'postedTrending'])
      .execute()

    const toInsert: SceneVotesOnPost[] = userScenes
      .filter((scene) => !res.some((row) => scene === row.did))
      .map((scene) => ({
        did: scene,
        subject: message.subject,
        count: 1,
        postedTrending: 0,
      }))

    if (toInsert.length > 0) {
      await db.db.insertInto('scene_votes_on_post').values(toInsert).execute()
    }
    await this.checkTrending(db, userScenes, message.subject)
  }

  private async handleRemoveUpvote(
    db: Database,
    message: RemoveUpvote,
  ): Promise<void> {
    const userScenes = await db.getScenesForUser(message.user)
    await db.db
      .updateTable('scene_votes_on_post')
      .set({ count: sql`count + 1` })
      .where('subject', '=', message.subject)
      .where('did', 'in', userScenes)
      .returning(['did', 'count'])
      .execute()
  }

  private async handleCreateNotification(
    db: Database,
    message: CreateNotification,
  ): Promise<void> {
    await db.db.insertInto('user_notification').values({
      userDid: message.userDid,
      recordUri: message.recordUri,
      recordCid: message.recordCid,
      author: message.author,
      reason: message.reason,
      reasonSubject: message.reasonSubject,
      indexedAt: new Date().toISOString(),
    })
  }

  private async handleDeleteNotifications(
    db: Database,
    message: DeleteNotifications,
  ) {
    await db.db
      .deleteFrom('user_notification')
      .where('recordUri', '=', message.recordUri)
      .execute()
  }

  // Side effects
  // -------------
  private async checkTrending(
    db: Database,
    scenes: string[],
    subject: string,
  ): Promise<void> {
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
        const ratio = scene.voteCount / scene.memberCount
        const shouldTrend = scene.voteCount > 1 && ratio > 0.2
        if (!shouldTrend) return

        // this is a "threshold vote" that makes the post trend
        const ctx = repoUtil.mutationContext(db, scene.did, now)
        const sceneAuth = this.getAuthStore(scene.did)
        const repoRoot = await db.getRepoRoot(scene.did, true)
        if (!repoRoot) {
          log.error({ scene: scene.did }, 'could not post trending record')
          return
        }
        const repo = await RepoStructure.load(ctx.blockstore, repoRoot)
        const trend = await repoUtil.prepareCreate(
          ctx,
          schema.ids.AppBskyFeedTrend,
          TID.nextStr(),
          {
            subject: {
              uri: scene.subject,
              cid: scene.subjectCid,
            },
            createdAt: now,
          },
        )
        const commit = repo
          .stageUpdate(trend.toStage)
          .createCommit(sceneAuth, async (_prev, curr) => {
            await db.db
              .insertInto('repo_root')
              .values({
                did: scene.did,
                root: curr.toString(),
                indexedAt: now,
              })
              .execute()
            return null
          })
        const setTrendPosted = db.db
          .updateTable('scene_votes_on_post')
          .set({ postedTrending: 1 })
          .where('did', '=', scene.did)
          .where('subject', '=', scene.subject)
          .execute()
        await Promise.all([commit, setTrendPosted, trend.dbUpdate])
      }),
    )
  }
}

export default SqlMessageQueue
