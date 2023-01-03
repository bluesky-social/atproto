import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { BlobStore } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../db'
import { MessageQueue } from '../event-stream/types'
import { ModerationAction, ModerationReport } from '../db/tables/moderation'
import {
  TAKEDOWN,
  View as ModerationActionView,
  SubjectRepo,
} from '../lexicon/types/com/atproto/admin/moderationAction'
import { InputSchema as TakeModAction } from '../lexicon/types/com/atproto/admin/takeModerationAction'
import { InputSchema as ReverseModAction } from '../lexicon/types/com/atproto/admin/reverseModerationAction'
import { OutputSchema as ReportOutput } from '../lexicon/types/com/atproto/report/create'
import { RepoService } from './repo'

export class ModerationService {
  constructor(
    public db: Database,
    public messageQueue: MessageQueue,
    public blobstore: BlobStore,
  ) {}

  static creator(messageQueue: MessageQueue, blobstore: BlobStore) {
    return (db: Database) => new ModerationService(db, messageQueue, blobstore)
  }

  get services() {
    return {
      repo: RepoService.creator(this.messageQueue, this.blobstore),
    }
  }

  async getAction(id: number): Promise<ModerationActionRow | undefined> {
    return await this.db.db
      .selectFrom('moderation_action')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async getActionOrThrow(id: number): Promise<ModerationActionRow> {
    const action = await this.getAction(id)
    if (!action) throw new InvalidRequestError('Action not found')
    return action
  }

  async logAction(
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

  async logReverseAction(
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

  async resolveReports(info: {
    reportIds: number[]
    actionId: number
    createdBy: string
    createdAt?: Date
  }): Promise<void> {
    const { reportIds, actionId, createdBy, createdAt = new Date() } = info
    const action = await this.getActionOrThrow(actionId)

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

  async formatActionView(
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

  async report(info: {
    reasonType: ModerationReportRow['reasonType']
    reason?: string
    subject: { did: string } | { uri: AtUri; cid?: CID }
    reportedByDid: string
    createdAt?: Date
  }): Promise<ModerationReportRow> {
    const {
      reasonType,
      reason,
      reportedByDid,
      createdAt = new Date(),
      subject,
    } = info

    // Resolve subject info
    let subjectInfo: ReportSubjectInfo
    if ('did' in subject) {
      const repo = await this.services.repo(this.db).getRepoRoot(subject.did)
      if (!repo) throw new InvalidRequestError('Repo not found')
      subjectInfo = {
        subjectType: 'com.atproto.report.subject#repo',
        subjectDid: subject.did,
        subjectUri: null,
        subjectCid: null,
      }
    } else {
      let builder = this.db.db
        .selectFrom('record')
        .select('cid')
        .where('record.uri', '=', subject.uri.toString())
      if (subject.cid) {
        builder = builder.where('record.cid', '=', subject.cid.toString())
      }
      const record = await builder.executeTakeFirst()
      if (!record) throw new InvalidRequestError('Record not found')
      subjectInfo = {
        subjectType: 'com.atproto.report.subject#record',
        subjectDid: subject.uri.host,
        subjectUri: subject.uri.toString(),
        subjectCid: record.cid,
      }
    }

    const report = await this.db.db
      .insertInto('moderation_report')
      .values({
        reasonType,
        reason: reason || null,
        createdAt: createdAt.toISOString(),
        reportedByDid,
        ...subjectInfo,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return report
  }

  formatReportView(report: ModerationReportRow): ReportOutput {
    return {
      id: report.id,
      createdAt: report.createdAt,
      reasonType: report.reasonType,
      reason: report.reason ?? undefined,
      reportedByDid: report.reportedByDid,
      subject:
        report.subjectType === 'com.atproto.report.subject#repo'
          ? {
              $type: 'com.atproto.report.subject#repo',
              did: report.subjectDid,
            }
          : {
              $type: 'com.atproto.report.view#recordRef',
              uri: report.subjectUri,
              cid: report.subjectCid,
            },
    }
  }
}

export type ModerationActionRow = Selectable<ModerationAction>

export type ModerationReportRow = Selectable<ModerationReport>

type ReportSubjectInfo =
  | {
      subjectType: 'com.atproto.report.subject#repo'
      subjectDid: string
      subjectUri: null
      subjectCid: null
    }
  | {
      subjectType: 'com.atproto.report.subject#record'
      subjectDid: string
      subjectUri: string
      subjectCid: string
    }
