import assert from 'node:assert'
import { PrimaryDatabase } from '../db'
import { Redis } from '../redis'
import { BsyncClient, Code, isBsyncError } from '../bsync'
import { MuteOperation, MuteOperation_Type } from '../proto/bsync_pb'
import logger from './logger'
import { wait } from '@atproto/common'
import {
  AtUri,
  InvalidDidError,
  ensureValidAtUri,
  ensureValidDid,
} from '@atproto/syntax'
import { ids } from '../lexicon/lexicons'

const CURSOR_KEY = 'ingester:mute:cursor'

export class MuteSubscription {
  ac = new AbortController()
  running: Promise<void> | undefined
  cursor: string | null = null

  constructor(
    public db: PrimaryDatabase,
    public redis: Redis,
    public bsyncClient: BsyncClient,
  ) {}

  async start() {
    if (this.running) return
    this.ac = new AbortController()
    this.running = this.run()
      .catch((err) => {
        // allow this to cause an unhandled rejection, let deployment handle the crash.
        logger.error({ err }, 'mute subscription crashed')
        throw err
      })
      .finally(() => (this.running = undefined))
  }

  private async run() {
    this.cursor = await this.getCursor()
    while (!this.ac.signal.aborted) {
      try {
        // get page of mute ops, long-polling
        const page = await this.bsyncClient.scanMuteOperations(
          {
            limit: 100,
            cursor: this.cursor ?? undefined,
          },
          { signal: this.ac.signal },
        )
        if (!page.cursor) {
          throw new BadResponseError('cursor is missing')
        }
        // process
        const now = new Date()
        for (const op of page.operations) {
          if (this.ac.signal.aborted) return
          if (op.type === MuteOperation_Type.ADD) {
            await this.handleAddOp(op, now)
          } else if (op.type === MuteOperation_Type.REMOVE) {
            await this.handleRemoveOp(op)
          } else if (op.type === MuteOperation_Type.CLEAR) {
            await this.handleClearOp(op)
          } else {
            logger.warn(
              { id: op.id, type: op.type },
              'unknown mute subscription op type',
            )
          }
        }
        // update cursor
        await this.setCursor(page.cursor)
        this.cursor = page.cursor
      } catch (err) {
        if (isBsyncError(err, Code.Canceled)) {
          return // canceled, probably from destroy()
        }
        if (err instanceof BadResponseError) {
          logger.warn({ err }, 'bad response from bsync')
        } else {
          logger.error({ err }, 'unexpected error processing mute subscription')
        }
        await wait(1000) // wait a second before trying again
      }
    }
  }

  async handleAddOp(op: MuteOperation, createdAt: Date) {
    assert(op.type === MuteOperation_Type.ADD)
    if (!isValidDid(op.actorDid)) {
      logger.warn({ id: op.id, type: op.type }, 'bad actor in mute op')
      return
    }
    if (isValidDid(op.subject)) {
      await this.db.db
        .insertInto('mute')
        .values({
          subjectDid: op.subject,
          mutedByDid: op.actorDid,
          createdAt: createdAt.toISOString(),
        })
        .onConflict((oc) => oc.doNothing())
        .execute()
    } else {
      const listUri = isValidAtUri(op.subject)
        ? new AtUri(op.subject)
        : undefined
      if (listUri?.collection !== ids.AppBskyGraphList) {
        logger.warn({ id: op.id, type: op.type }, 'bad subject in mute op')
        return
      }
      await this.db.db
        .insertInto('list_mute')
        .values({
          listUri: op.subject,
          mutedByDid: op.actorDid,
          createdAt: createdAt.toISOString(),
        })
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }

  async handleRemoveOp(op: MuteOperation) {
    assert(op.type === MuteOperation_Type.REMOVE)
    if (!isValidDid(op.actorDid)) {
      logger.warn({ id: op.id, type: op.type }, 'bad actor in mute op')
      return
    }
    if (isValidDid(op.subject)) {
      await this.db.db
        .deleteFrom('mute')
        .where('subjectDid', '=', op.subject)
        .where('mutedByDid', '=', op.actorDid)
        .execute()
    } else {
      const listUri = isValidAtUri(op.subject)
        ? new AtUri(op.subject)
        : undefined
      if (listUri?.collection !== ids.AppBskyGraphList) {
        logger.warn({ id: op.id, type: op.type }, 'bad subject in mute op')
        return
      }
      await this.db.db
        .deleteFrom('list_mute')
        .where('listUri', '=', op.subject)
        .where('mutedByDid', '=', op.actorDid)
        .execute()
    }
  }

  async handleClearOp(op: MuteOperation) {
    assert(op.type === MuteOperation_Type.CLEAR)
    if (!isValidDid(op.actorDid)) {
      logger.warn({ id: op.id, type: op.type }, 'bad actor in mute op')
      return
    }
    if (op.subject) {
      logger.warn({ id: op.id, type: op.type }, 'bad subject in mute op')
      return
    }
    await this.db.db
      .deleteFrom('mute')
      .where('mutedByDid', '=', op.actorDid)
      .execute()
    await this.db.db
      .deleteFrom('list_mute')
      .where('mutedByDid', '=', op.actorDid)
      .execute()
  }

  async getCursor(): Promise<string | null> {
    return await this.redis.get(CURSOR_KEY)
  }

  async setCursor(cursor: string): Promise<void> {
    await this.redis.set(CURSOR_KEY, cursor)
  }

  async destroy() {
    this.ac.abort()
    await this.running
  }

  get destroyed() {
    return this.ac.signal.aborted
  }
}

class BadResponseError extends Error {}

const isValidDid = (did: string) => {
  try {
    ensureValidDid(did)
    return true
  } catch (err) {
    if (err instanceof InvalidDidError) {
      return false
    }
    throw err
  }
}

const isValidAtUri = (uri: string) => {
  try {
    ensureValidAtUri(uri)
    return true
  } catch {
    return false
  }
}
