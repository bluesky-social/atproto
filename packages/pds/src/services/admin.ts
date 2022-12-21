import { Selectable } from 'kysely'
import Database from '../db'
import { ModerationAction } from '../db/tables/moderation'
import { View as ModerationActionView } from '../lexicon/types/app/bsky/administration/moderationAction'
import { InputSchema as TakeModAction } from '../lexicon/types/app/bsky/administration/takeModerationAction'
import { InputSchema as ReverseModAction } from '../lexicon/types/app/bsky/administration/reverseModerationAction'
import * as ActorRef from '../lexicon/types/app/bsky/actor/ref'
import { ids } from '../lexicon/lexicons'
import { InvalidRequestError } from '@atproto/xrpc-server'

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
      action: 'takedown'
      subject: ActorRef.Main
      createdAt?: Date
    },
  ): Promise<Selectable<ModerationAction>> {
    const {
      action,
      createdBy,
      rationale,
      subject,
      createdAt = new Date(),
    } = info

    return await this.db.db
      .insertInto('moderation_action')
      .values({
        action,
        subjectType: 'actor',
        subjectDid: subject.did,
        subjectDeclarationCid: subject.declarationCid,
        createdAt: createdAt.toISOString(),
        createdBy,
        rationale,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async logReverseModAction(
    info: ReverseModAction & { reversedAt: Date },
  ): Promise<Selectable<ModerationAction>> {
    const { id, reversedBy, reversedRationale, reversedAt = new Date() } = info

    const result = await this.db.db
      .updateTable('moderation_action')
      .where('id', '=', id)
      .set({
        reversedAt: reversedAt.toISOString(),
        reversedBy,
        reversedRationale,
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
    if (modAction.subjectType !== 'actor') {
      throw new Error('Only supports format moderation actions on actors')
    }
    return {
      id: modAction.id,
      action: modAction.action,
      subject: {
        $type: ids.AppBskyActorRef,
        did: modAction.subjectDid,
        declarationCid: modAction.subjectDeclarationCid,
      },
      rationale: modAction.rationale,
      createdAt: modAction.createdAt,
      createdBy: modAction.createdBy,
      reversedAt: modAction.reversedAt ?? undefined,
      reversedBy: modAction.reversedBy ?? undefined,
      reversedRationale: modAction.reversedRationale ?? undefined,
    }
  }
}
