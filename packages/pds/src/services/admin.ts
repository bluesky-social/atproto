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

  async getModAction(id: number): Promise<ModerationActionRow | undefined> {
    return await this.db.db
      .selectFrom('moderation_action')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async getModActionOrThrow(id: number): Promise<ModerationActionRow> {
    const action = await this.getModAction(id)
    if (!action) throw new InvalidRequestError('Action not found')
    return action
  }

  async logModAction(
    info: TakeModAction & {
      action: typeof TAKEDOWN
      subject: SubjectRepo
      createdAt?: Date
    },
  ): Promise<ModerationActionRow> {
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
  ): Promise<ModerationActionRow> {
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
      throw new InvalidRequestError('Moderation action not found')
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

  async resolveModReports(info: {
    reportIds: number[]
    actionId: number
    createdBy: string
    createdAt?: Date
  }): Promise<void> {
    const { reportIds, actionId, createdBy, createdAt = new Date() } = info
    const action = await this.getModActionOrThrow(actionId)

    if (!reportIds.length) return
    const reports = await this.db.db
      .selectFrom('moderation_report')
      .where('id', 'in', reportIds)
      .select(['id', 'subjectDid'])
      .execute()

    reportIds.forEach((reportId) => {
      const report = reports.find((r) => r.id === reportId)
      if (!report) throw new InvalidRequestError('Report not found')
      if (action.subjectDid !== report.subjectDid) {
        // @TODO if the report and action are both for a record, ensure they are for the same record.
        // Otherwise, if one is for a repo and the other a record, just ensure the repo/did matches.
        throw new InvalidRequestError(
          `Report ${report.id} cannot be resolved by action`,
        )
      }
    })

    await this.db.db
      .insertInto('moderation_report_resolution')
      .values(
        reportIds.map((reportId) => ({
          reportId,
          actionId,
          createdAt: createdAt.toISOString(),
          createdBy,
        })),
      )
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async formatModActionView(
    modAction: ModerationActionRow,
  ): Promise<ModerationActionView> {
    if (
      modAction.subjectType !== 'com.atproto.admin.moderationAction#subjectRepo'
    ) {
      throw new Error('Only supports format moderation actions on actors')
    }
    const resolutions = await this.db.db
      .selectFrom('moderation_report_resolution')
      .select('reportId as id')
      .where('actionId', '=', modAction.id)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .execute()
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
      resolvedReports: resolutions,
    }
  }
}

export type ModerationActionRow = Selectable<ModerationAction>
