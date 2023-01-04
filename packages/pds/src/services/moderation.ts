import { Selectable } from 'kysely'
import { CID } from 'multiformats/cid'
import { BlobStore } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../db'
import { MessageQueue } from '../event-stream/types'
import { ModerationAction, ModerationReport } from '../db/tables/moderation'
import { View as ModerationActionView } from '../lexicon/types/com/atproto/admin/moderationAction'
import { OutputSchema as ReportOutput } from '../lexicon/types/com/atproto/report/create'
import { RepoService } from './repo'
import { RecordService } from './record'

export class ModerationService {
  constructor(
    public db: Database,
    public messageQueue: MessageQueue,
    public blobstore: BlobStore,
  ) {}

  static creator(messageQueue: MessageQueue, blobstore: BlobStore) {
    return (db: Database) => new ModerationService(db, messageQueue, blobstore)
  }

  services = {
    repo: RepoService.creator(this.messageQueue, this.blobstore),
    record: RecordService.creator(this.messageQueue),
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

  async logAction(info: {
    action: ModerationActionRow['action']
    subject: { did: string } | { uri: AtUri; cid?: CID }
    reason: string
    createdBy: string
    createdAt?: Date
  }): Promise<ModerationActionRow> {
    const { action, createdBy, reason, subject, createdAt = new Date() } = info

    // Resolve subject info
    let subjectInfo: SubjectInfo
    if ('did' in subject) {
      const repo = await this.services.repo(this.db).getRepoRoot(subject.did)
      if (!repo) throw new InvalidRequestError('Repo not found')
      subjectInfo = {
        subjectType: 'com.atproto.repo.repoRef',
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
        subjectType: 'com.atproto.repo.recordRef',
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

  async logReverseAction(info: {
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
      .updateTable('repo_root')
      .set({ takedownId: info.takedownId })
      .where('did', '=', info.did)
      .where('takedownId', 'is', null)
      .executeTakeFirst()
  }

  async reverseTakedownRepo(info: { did: string }) {
    await this.db.db
      .updateTable('repo_root')
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
        action.subjectType === 'com.atproto.repo.recordRef' &&
        report.subjectType === 'com.atproto.repo.recordRef' &&
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

  async formatActionView(
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
        modAction.subjectType === 'com.atproto.repo.repoRef'
          ? {
              $type: 'com.atproto.repo.repoRef',
              did: modAction.subjectDid,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
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
    let subjectInfo: SubjectInfo
    if ('did' in subject) {
      const repo = await this.services.repo(this.db).getRepoRoot(subject.did)
      if (!repo) throw new InvalidRequestError('Repo not found')
      subjectInfo = {
        subjectType: 'com.atproto.repo.repoRef',
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
        subjectType: 'com.atproto.repo.recordRef',
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
        report.subjectType === 'com.atproto.repo.repoRef'
          ? {
              $type: 'com.atproto.repo.repoRef',
              did: report.subjectDid,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
              uri: report.subjectUri,
              cid: report.subjectCid,
            },
    }
  }
}

export type ModerationActionRow = Selectable<ModerationAction>

export type ModerationReportRow = Selectable<ModerationReport>

type SubjectInfo =
  | {
      subjectType: 'com.atproto.repo.repoRef'
      subjectDid: string
      subjectUri: null
      subjectCid: null
    }
  | {
      subjectType: 'com.atproto.repo.recordRef'
      subjectDid: string
      subjectUri: string
      subjectCid: string
    }
