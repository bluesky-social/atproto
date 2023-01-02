import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../db'
import { ModerationAction } from '../db/tables/moderation'
import { View as ModerationActionView } from '../lexicon/types/com/atproto/admin/moderationAction'
import { Services } from '.'

export class AdminService {
  constructor(public services: Services, public db: Database) {}

  static creator(services: Services) {
    return (db: Database) => new AdminService(services, db)
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

  async logModAction(info: {
    action: ModerationActionRow['action']
    subject: { did: string } | { uri: AtUri; cid?: CID }
    reason: string
    createdBy: string
    createdAt?: Date
  }): Promise<ModerationActionRow> {
    const { action, createdBy, reason, subject, createdAt = new Date() } = info

    // Resolve subject info
    let subjectInfo: ActionSubjectInfo
    if ('did' in subject) {
      const repo = await this.services.repo(this.db).getRepoRoot(subject.did)
      if (!repo) throw new InvalidRequestError('Repo not found')
      subjectInfo = {
        subjectType: 'com.atproto.admin.moderationAction#subjectRepo',
        subjectDid: subject.did,
        subjectUri: null,
        subjectCid: null,
      }
    } else {
      const record = await this.services
        .record(this.db)
        .getRecord(subject.uri, subject.cid?.toString() ?? null, true)
      if (!record) throw new InvalidRequestError('Record not found')
      subjectInfo = {
        subjectType: 'com.atproto.admin.moderationAction#subjectRecord',
        subjectDid: subject.uri.host,
        subjectUri: subject.uri.toString(),
        subjectCid: record.cid,
      }
    }

    return await this.db.db
      .insertInto('moderation_action')
      .values({
        action,
        reason,
        createdAt: createdAt.toISOString(),
        createdBy,
        ...subjectInfo,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async logReverseModAction(info: {
    id: number
    reason: string
    createdBy: string
    createdAt?: Date
  }): Promise<ModerationActionRow> {
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

  async takedownRepo(info: { takedownId: number; did: string }) {
    await this.db.db
      .updateTable('did_handle')
      .set({ takedownId: info.takedownId })
      .where('did', '=', info.did)
      .where('takedownId', 'is', null)
      .executeTakeFirst()
  }

  async reverseTakedownRepo(info: { did: string }) {
    await this.db.db
      .updateTable('did_handle')
      .set({ takedownId: null })
      .where('did', '=', info.did)
      .execute()
  }

  async takedownRecord(info: { takedownId: number; uri: AtUri }) {
    await this.db.db
      .updateTable('record')
      .set({ takedownId: info.takedownId })
      .where('uri', '=', info.uri.toString())
      .where('takedownId', 'is', null)
      .executeTakeFirst()
  }

  async reverseTakedownRecord(info: { uri: AtUri }) {
    await this.db.db
      .updateTable('record')
      .set({ takedownId: null })
      .where('uri', '=', info.uri.toString())
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
      .select(['id', 'subjectType', 'subjectDid', 'subjectUri'])
      .execute()

    reportIds.forEach((reportId) => {
      const report = reports.find((r) => r.id === reportId)
      if (!report) throw new InvalidRequestError('Report not found')
      if (action.subjectDid !== report.subjectDid) {
        // Report and action always must target repo or record from the same did
        throw new InvalidRequestError(
          `Report ${report.id} cannot be resolved by action`,
        )
      }
      if (
        action.subjectType ===
          'com.atproto.admin.moderationAction#subjectRecord' &&
        report.subjectType === 'com.atproto.repo.report#subjectRecord' &&
        report.subjectUri !== action.subjectUri
      ) {
        // If report and action are both for a record, they must be for the same record
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
      subject:
        modAction.subjectType ===
        'com.atproto.admin.moderationAction#subjectRepo'
          ? {
              $type: 'com.atproto.admin.moderationAction#subjectRepo',
              did: modAction.subjectDid,
            }
          : {
              $type: 'com.atproto.admin.moderationAction#subjectRecordRef',
              uri: modAction.subjectUri,
              cid: modAction.subjectCid,
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

type ActionSubjectInfo =
  | {
      subjectType: 'com.atproto.admin.moderationAction#subjectRepo'
      subjectDid: string
      subjectUri: null
      subjectCid: null
    }
  | {
      subjectType: 'com.atproto.admin.moderationAction#subjectRecord'
      subjectDid: string
      subjectUri: string
      subjectCid: string
    }
