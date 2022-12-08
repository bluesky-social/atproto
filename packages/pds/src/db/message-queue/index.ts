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
import { AuthStore } from '@atproto/auth'
import * as repo from '../../repo'
import * as lexicons from '../../lexicon/lexicons'
import { TID } from '@atproto/common'
import { MessageQueue } from '../types'

type GetAuthStoreFn = (did: string) => AuthStore

export class SqlMessageQueue implements MessageQueue {
  private cursorExists = false
  private ensureCaughtUpTimeout: ReturnType<typeof setTimeout> | undefined

  constructor(
    private name: string,
    private db: Database,
    private getAuthStore: GetAuthStoreFn,
  ) {
    this.ensureCaughtUp()
  }

  async send(tx: Database, messages: Message | Message[]): Promise<void> {
    const msgArray = Array.isArray(messages) ? messages : [messages]
    if (msgArray.length === 0) return
    const now = new Date().toISOString()
    const values = msgArray.map((msg) => ({
      message: JSON.stringify(msg),
      createdAt: now,
    }))

    await tx.db.insertInto('message_queue').values(values).execute()
    for (let i = 0; i < msgArray.length; i++) {
      this.processNext().catch((err) => {
        log.error({ err }, 'error processing message')
      })
    }
  }

  private async ensureCursor(): Promise<void> {
    if (this.cursorExists) return
    await this.db.db
      .insertInto('message_queue_cursor')
      .values({ consumer: this.name, cursor: 1 })
      .onConflict((oc) => oc.doNothing())
      .execute()
    this.cursorExists = true
  }

  async ensureCaughtUp(): Promise<void> {
    try {
      await this.processAll()
    } catch (err) {
      log.error({ err }, 'error ensuring queue is up to date')
    }
    this.ensureCaughtUpTimeout = setTimeout(() => this.ensureCaughtUp(), 60000) // 1 min
  }

  destroy() {
    if (this.ensureCaughtUpTimeout) {
      clearTimeout(this.ensureCaughtUpTimeout)
    }
  }

  async processAll(): Promise<void> {
    await this.ensureCursor()
    await this.db.transaction(async (dbTxn) => {
      let builder = dbTxn.db
        .selectFrom('message_queue_cursor as cursor')
        .innerJoin('message_queue', (join) =>
          join.onRef('cursor.cursor', '<=', 'message_queue.id'),
        )
        .where('cursor.consumer', '=', this.name)
        .selectAll()
      if (this.db.dialect !== 'sqlite') {
        builder = builder.forUpdate()
      }
      const res = await builder.execute()
      // all caught up
      if (res.length === 0) return

      for (const row of res) {
        const message: Message = JSON.parse(row.message)
        await this.handleMessage(dbTxn, message)
      }
      const nextCursor = res[res.length - 1].id + 1
      await dbTxn.db
        .updateTable('message_queue_cursor')
        .set({ cursor: nextCursor })
        .where('consumer', '=', this.name)
        .execute()
    })
  }

  async processNext(): Promise<void> {
    await this.ensureCursor()
    await this.db.transaction(async (dbTxn) => {
      let builder = dbTxn.db
        .selectFrom('message_queue_cursor as cursor')
        .innerJoin('message_queue', (join) =>
          join.onRef('cursor.cursor', '<=', 'message_queue.id'),
        )
        .where('cursor.consumer', '=', this.name)
        .orderBy('id', 'asc')
        .limit(1)
        .selectAll()
      if (this.db.dialect !== 'sqlite') {
        builder = builder.forUpdate()
      }

      const res = await builder.executeTakeFirst()
      // all caught up
      if (!res) return

      const message: Message = JSON.parse(res.message)
      await this.handleMessage(dbTxn, message)

      const nextCursor = res.id + 1
      await dbTxn.db
        .updateTable('message_queue_cursor')
        .set({ cursor: nextCursor })
        .where('consumer', '=', this.name)
        .returningAll()
        .execute()
    })
  }

  private async handleMessage(db: Database, message: Message) {
    try {
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
    } catch (err) {
      log.error({ message, err }, 'unable to handle event')
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
      .returningAll()
      .executeTakeFirst()
    if (!res) {
      await db.db
        .insertInto('scene_member_count')
        .values({ did: message.scene, count: 1 })
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

  private async handleRemoveUpvote(
    db: Database,
    message: RemoveUpvote,
  ): Promise<void> {
    const userScenes = await db.getScenesForUser(message.user)
    if (userScenes.length === 0) return
    await db.db
      .updateTable('scene_votes_on_post')
      .set({ count: sql`count - 1` })
      .where('subject', '=', message.subject)
      .where('did', 'in', userScenes)
      .returning(['did', 'count'])
      .execute()
  }

  private async handleCreateNotification(
    db: Database,
    message: CreateNotification,
  ): Promise<void> {
    await db.db
      .insertInto('user_notification')
      .values({
        userDid: message.userDid,
        recordUri: message.recordUri,
        recordCid: message.recordCid,
        author: message.author,
        reason: message.reason,
        reasonSubject: message.reasonSubject,
        indexedAt: new Date().toISOString(),
      })
      .returningAll()
      .execute()
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

export default SqlMessageQueue
