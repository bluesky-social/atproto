import { Selectable, sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { BlobStore } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import Database from '../../db'
import { ModerationAction, ModerationReport } from '../../db/tables/moderation'
import { RecordService } from '../record'
import { ModerationViews } from './views'
import SqlRepoStorage from '../../sql-repo-storage'
import { TAKEDOWN } from '../../lexicon/types/com/atproto/admin/defs'
import { addHoursToDate } from '../../util/date'

export class ModerationService {
  constructor(public db: Database, public blobstore: BlobStore) {}

  static creator(blobstore: BlobStore) {
    return (db: Database) => new ModerationService(db, blobstore)
  }

  views = new ModerationViews(this.db)

  services = {
    record: RecordService.creator(),
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

  async getActions(opts: {
    subject?: string
    limit: number
    cursor?: string
  }): Promise<ModerationActionRow[]> {
    const { subject, limit, cursor } = opts
    let builder = this.db.db.selectFrom('moderation_action')
    if (subject) {
      builder = builder.where((qb) => {
        return qb
          .where('subjectDid', '=', subject)
          .orWhere('subjectUri', '=', subject)
      })
    }
    if (cursor) {
      const cursorNumeric = parseInt(cursor, 10)
      if (isNaN(cursorNumeric)) {
        throw new InvalidRequestError('Malformed cursor')
      }
      builder = builder.where('id', '<', cursorNumeric)
    }
    return await builder
      .selectAll()
      .orderBy('id', 'desc')
      .limit(limit)
      .execute()
  }

  async getReport(id: number): Promise<ModerationReportRow | undefined> {
    return await this.db.db
      .selectFrom('moderation_report')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async getReports(opts: {
    subject?: string
    resolved?: boolean
    actionType?: string
    limit: number
    cursor?: string
    ignoreSubjects?: string[]
    reverse?: boolean
    reporters?: string[]
    actionedBy?: string
  }): Promise<ModerationReportRowWithHandle[]> {
    const {
      subject,
      resolved,
      actionType,
      limit,
      cursor,
      ignoreSubjects,
      reverse = false,
      reporters,
      actionedBy,
    } = opts
    const { ref } = this.db.db.dynamic
    let builder = this.db.db.selectFrom('moderation_report')
    if (subject) {
      builder = builder.where((qb) => {
        return qb
          .where('subjectDid', '=', subject)
          .orWhere('subjectUri', '=', subject)
      })
    }

    if (ignoreSubjects?.length) {
      const ignoreUris: string[] = []
      const ignoreDids: string[] = []

      ignoreSubjects.forEach((subject) => {
        if (subject.startsWith('at://')) {
          ignoreUris.push(subject)
        } else if (subject.startsWith('did:')) {
          ignoreDids.push(subject)
        }
      })

      if (ignoreDids.length) {
        builder = builder.where('subjectDid', 'not in', ignoreDids)
      }
      if (ignoreUris.length) {
        builder = builder.where((qb) => {
          // Without the null condition, postgres will ignore all reports where `subjectUri` is null
          // which will make all the account reports be ignored as well
          return qb
            .where('subjectUri', 'not in', ignoreUris)
            .orWhere('subjectUri', 'is', null)
        })
      }
    }

    if (reporters?.length) {
      builder = builder.where('reportedByDid', 'in', reporters)
    }

    if (resolved !== undefined) {
      const resolutionsQuery = this.db.db
        .selectFrom('moderation_report_resolution')
        .selectAll()
        .whereRef(
          'moderation_report_resolution.reportId',
          '=',
          ref('moderation_report.id'),
        )
      builder = resolved
        ? builder.whereExists(resolutionsQuery)
        : builder.whereNotExists(resolutionsQuery)
    }
    if (actionType !== undefined || actionedBy !== undefined) {
      let resolutionActionsQuery = this.db.db
        .selectFrom('moderation_report_resolution')
        .innerJoin(
          'moderation_action',
          'moderation_action.id',
          'moderation_report_resolution.actionId',
        )
        .whereRef(
          'moderation_report_resolution.reportId',
          '=',
          ref('moderation_report.id'),
        )

      if (actionType) {
        resolutionActionsQuery = resolutionActionsQuery
          .where('moderation_action.action', '=', sql`${actionType}`)
          .where('moderation_action.reversedAt', 'is', null)
      }

      if (actionedBy) {
        resolutionActionsQuery = resolutionActionsQuery.where(
          'moderation_action.createdBy',
          '=',
          actionedBy,
        )
      }

      builder = builder.whereExists(resolutionActionsQuery.selectAll())
    }

    if (cursor) {
      const cursorNumeric = parseInt(cursor, 10)
      if (isNaN(cursorNumeric)) {
        throw new InvalidRequestError('Malformed cursor')
      }
      builder = builder.where('id', reverse ? '>' : '<', cursorNumeric)
    }

    return await builder
      .leftJoin('did_handle', 'did_handle.did', 'moderation_report.subjectDid')
      .selectAll(['moderation_report', 'did_handle'])
      .orderBy('id', reverse ? 'asc' : 'desc')
      .limit(limit)
      .execute()
  }

  async getReportOrThrow(id: number): Promise<ModerationReportRow> {
    const report = await this.getReport(id)
    if (!report) throw new InvalidRequestError('Report not found')
    return report
  }

  async getCurrentActions(
    subject: { did: string } | { uri: AtUri } | { cids: CID[] },
  ) {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db
      .selectFrom('moderation_action')
      .selectAll()
      .where('reversedAt', 'is', null)
    if ('did' in subject) {
      builder = builder
        .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
        .where('subjectDid', '=', subject.did)
    } else if ('uri' in subject) {
      builder = builder
        .where('subjectType', '=', 'com.atproto.repo.strongRef')
        .where('subjectUri', '=', subject.uri.toString())
    } else {
      const blobsForAction = this.db.db
        .selectFrom('moderation_action_subject_blob')
        .selectAll()
        .whereRef('actionId', '=', ref('moderation_action.id'))
        .where(
          'cid',
          'in',
          subject.cids.map((cid) => cid.toString()),
        )
      builder = builder.whereExists(blobsForAction)
    }
    return await builder.execute()
  }

  async logAction(info: {
    action: ModerationActionRow['action']
    subject: { did: string } | { uri: AtUri; cid: CID }
    subjectBlobCids?: CID[]
    reason: string
    createLabelVals?: string[]
    negateLabelVals?: string[]
    createdBy: string
    createdAt?: Date
    durationInHours?: number
  }): Promise<ModerationActionRow> {
    this.db.assertTransaction()
    const {
      action,
      createdBy,
      reason,
      subject,
      subjectBlobCids,
      durationInHours,
      createdAt = new Date(),
    } = info
    const createLabelVals =
      info.createLabelVals && info.createLabelVals.length > 0
        ? info.createLabelVals.join(' ')
        : undefined
    const negateLabelVals =
      info.negateLabelVals && info.negateLabelVals.length > 0
        ? info.negateLabelVals.join(' ')
        : undefined

    // Resolve subject info
    let subjectInfo: SubjectInfo
    if ('did' in subject) {
      // Allowing dids that may not exist: may have been deleted but needs to remain actionable.
      subjectInfo = {
        subjectType: 'com.atproto.admin.defs#repoRef',
        subjectDid: subject.did,
        subjectUri: null,
        subjectCid: null,
      }
      if (subjectBlobCids?.length) {
        throw new InvalidRequestError('Blobs do not apply to repo subjects')
      }
    } else {
      // Allowing records/blobs that may not exist: may have been deleted but needs to remain actionable.
      subjectInfo = {
        subjectType: 'com.atproto.repo.strongRef',
        subjectDid: subject.uri.host,
        subjectUri: subject.uri.toString(),
        subjectCid: subject.cid.toString(),
      }
      if (subjectBlobCids?.length) {
        const cidsFromSubject = await this.db.db
          .selectFrom('repo_blob')
          .where('recordUri', '=', subject.uri.toString())
          .where(
            'cid',
            'in',
            subjectBlobCids.map((c) => c.toString()),
          )
          .select('cid')
          .execute()
        if (cidsFromSubject.length !== subjectBlobCids.length) {
          throw new InvalidRequestError('Blobs do not match record subject')
        }
      }
    }

    const subjectActions = await this.getCurrentActions(subject)
    if (subjectActions.length) {
      throw new InvalidRequestError(
        `Subject already has an active action: #${subjectActions[0].id}`,
        'SubjectHasAction',
      )
    }

    const actionResult = await this.db.db
      .insertInto('moderation_action')
      .values({
        action,
        reason,
        createdAt: createdAt.toISOString(),
        createdBy,
        createLabelVals,
        negateLabelVals,
        durationInHours,
        expiresAt:
          durationInHours !== undefined
            ? addHoursToDate(durationInHours, createdAt).toISOString()
            : undefined,
        ...subjectInfo,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    if (subjectBlobCids?.length && !('did' in subject)) {
      const blobActions = await this.getCurrentActions({
        cids: subjectBlobCids,
      })
      if (blobActions.length) {
        throw new InvalidRequestError(
          `Blob already has an active action: #${blobActions[0].id}`,
          'SubjectHasAction',
        )
      }

      await this.db.db
        .insertInto('moderation_action_subject_blob')
        .values(
          subjectBlobCids.map((cid) => ({
            actionId: actionResult.id,
            cid: cid.toString(),
            recordUri: subject.uri.toString(),
          })),
        )
        .execute()
    }

    return actionResult
  }

  async getActionsDueForReversal(): Promise<Array<ModerationActionRow>> {
    const actionsDueForReversal = await this.db.db
      .selectFrom('moderation_action')
      // Get entries that have an durationInHours that has passed and have not been reversed
      .where('durationInHours', 'is not', null)
      .where('expiresAt', '<', new Date().toISOString())
      .where('reversedAt', 'is', null)
      .selectAll()
      .execute()

    return actionsDueForReversal
  }

  async revertAction({
    id,
    createdAt,
    createdBy,
    reason,
  }: {
    id: number
    createdAt: Date
    createdBy: string
    reason: string
  }) {
    const result = await this.logReverseAction({
      id,
      createdAt,
      createdBy,
      reason,
    })

    if (
      result.action === TAKEDOWN &&
      result.subjectType === 'com.atproto.admin.defs#repoRef' &&
      result.subjectDid
    ) {
      await this.reverseTakedownRepo({
        did: result.subjectDid,
      })
    }

    if (
      result.action === TAKEDOWN &&
      result.subjectType === 'com.atproto.repo.strongRef' &&
      result.subjectUri
    ) {
      await this.reverseTakedownRecord({
        uri: new AtUri(result.subjectUri),
      })
    }

    return result
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

  async takedownRecord(info: {
    takedownId: number
    uri: AtUri
    blobCids?: CID[]
  }) {
    this.db.assertTransaction()
    await this.db.db
      .updateTable('record')
      .set({ takedownId: info.takedownId })
      .where('uri', '=', info.uri.toString())
      .where('takedownId', 'is', null)
      .executeTakeFirst()
    if (info.blobCids?.length) {
      await this.db.db
        .updateTable('repo_blob')
        .set({ takedownId: info.takedownId })
        .where('recordUri', '=', info.uri.toString())
        .where(
          'cid',
          'in',
          info.blobCids.map((c) => c.toString()),
        )
        .where('takedownId', 'is', null)
        .executeTakeFirst()
      await Promise.all(
        info.blobCids.map((cid) => this.blobstore.quarantine(cid)),
      )
    }
  }

  async reverseTakedownRecord(info: { uri: AtUri }) {
    this.db.assertTransaction()
    await this.db.db
      .updateTable('record')
      .set({ takedownId: null })
      .where('uri', '=', info.uri.toString())
      .execute()
    const blobs = await this.db.db
      .updateTable('repo_blob')
      .set({ takedownId: null })
      .where('takedownId', 'is not', null)
      .where('recordUri', '=', info.uri.toString())
      .returning('cid')
      .execute()
    await Promise.all(
      blobs.map(async (blob) => {
        const cid = CID.parse(blob.cid)
        await this.blobstore.unquarantine(cid)
      }),
    )
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
        action.subjectType === 'com.atproto.repo.strongRef' &&
        report.subjectType === 'com.atproto.repo.strongRef' &&
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

  async report(info: {
    reasonType: ModerationReportRow['reasonType']
    reason?: string
    subject: { did: string } | { uri: AtUri; cid?: CID }
    reportedBy: string
    createdAt?: Date
  }): Promise<ModerationReportRow> {
    const {
      reasonType,
      reason,
      reportedBy,
      createdAt = new Date(),
      subject,
    } = info

    // Resolve subject info
    let subjectInfo: SubjectInfo
    if ('did' in subject) {
      const repo = await new SqlRepoStorage(this.db, subject.did).getRoot()
      if (!repo) throw new InvalidRequestError('Repo not found')
      subjectInfo = {
        subjectType: 'com.atproto.admin.defs#repoRef',
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
        subjectType: 'com.atproto.repo.strongRef',
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
        reportedByDid: reportedBy,
        ...subjectInfo,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return report
  }
}

export type ModerationActionRow = Selectable<ModerationAction>

export type ModerationReportRow = Selectable<ModerationReport>
export type ModerationReportRowWithHandle = ModerationReportRow & {
  handle?: string | null
}

export type SubjectInfo =
  | {
      subjectType: 'com.atproto.admin.defs#repoRef'
      subjectDid: string
      subjectUri: null
      subjectCid: null
    }
  | {
      subjectType: 'com.atproto.repo.strongRef'
      subjectDid: string
      subjectUri: string
      subjectCid: string
    }
