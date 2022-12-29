import { Selectable } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../db'
import { ModerationAction } from '../db/tables/moderation'
import {
  TAKEDOWN,
  View as ModerationActionView,
  SubjectRepo,
} from '../lexicon/types/com/atproto/admin/moderationAction'
import { InputSchema as TakeModAction } from '../lexicon/types/com/atproto/admin/takeModerationAction'
import { InputSchema as ReverseModAction } from '../lexicon/types/com/atproto/admin/reverseModerationAction'

export class AdminService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new AdminService(db)
  }

  async getModAction(
    id: number,
  ): Promise<Selectable<ModerationAction> | undefined> {
    return await this.db.db
      .selectFrom('moderation_action')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async logModAction(
    info: TakeModAction & {
      action: typeof TAKEDOWN
      subject: SubjectRepo
      createdAt?: Date
    },
  ): Promise<Selectable<ModerationAction>> {
    const { action, createdBy, reason, subject, createdAt = new Date() } = info

    return await this.db.db
      .insertInto('moderation_action')
      .values({
        action,
        subjectType: 'com.atproto.admin.moderationAction#subjectRepo',
        subjectDid: subject.did,
        createdAt: createdAt.toISOString(),
        createdBy,
        reason,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async logReverseModAction(
    info: ReverseModAction & { createdAt: Date },
  ): Promise<Selectable<ModerationAction>> {
    const { id, createdBy, reason, createdAt = new Date() } = info

    const result = await this.db.db
      .updateTable('moderation_action')
      .where('id', '=', id)
      .set({
        reversedAt: createdAt.toISOString(),
        reversedBy: createdBy,
        reversedReason: reason,
      })
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new InvalidRequestError('Moderation action does not exist')
    }

    return result
  }

  async takedownActorByDid(info: { takedownId: number; did: string }) {
    await this.db.db
      .updateTable('did_handle')
      .set({ takedownId: info.takedownId })
      .where('did', '=', info.did)
      .where('takedownId', 'is', null)
      .executeTakeFirst()
  }

  async reverseTakedownActorByDid(info: { did: string }) {
    await this.db.db
      .updateTable('did_handle')
      .set({ takedownId: null })
      .where('did', '=', info.did)
      .execute()
  }

  formatModActionView(
    modAction: Selectable<ModerationAction>,
  ): ModerationActionView {
    if (
      modAction.subjectType !== 'com.atproto.admin.moderationAction#subjectRepo'
    ) {
      throw new Error('Only supports format moderation actions on actors')
    }
    return {
      id: modAction.id,
      action: modAction.action,
      subject: {
        $type: modAction.subjectType,
        did: modAction.subjectDid,
      },
      reason: modAction.reason,
      createdAt: modAction.createdAt,
      createdBy: modAction.createdBy,
      reversal:
        modAction.reversedAt !== null &&
        modAction.reversedBy !== null &&
        modAction.reversedReason !== null
          ? {
              createdAt: modAction.reversedAt,
              createdBy: modAction.reversedBy,
              reason: modAction.reversedReason,
            }
          : undefined,
    }
  }
}
