import { Selectable, sql } from 'kysely'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { PrimaryDatabase } from '../../db'
import { ModerationAction, ModerationReport } from '../../db/tables/moderation'
import { ModerationViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { ImageInvalidator } from '../../image/invalidator'
import { TAKEDOWN } from '../../lexicon/types/com/atproto/admin/defs'
import { addHoursToDate } from '../../util/date'

export class ModerationService {
  constructor(
    public db: PrimaryDatabase,
    public imgUriBuilder: ImageUriBuilder,
    public imgInvalidator: ImageInvalidator,
  ) {}

  static creator(
    imgUriBuilder: ImageUriBuilder,
    imgInvalidator: ImageInvalidator,
  ) {
    return (db: PrimaryDatabase) =>
      new ModerationService(db, imgUriBuilder, imgInvalidator)
  }

  views = new ModerationViews(this.db)

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
      .leftJoin('actor', 'actor.did', 'moderation_report.subjectDid')
      .selectAll(['moderation_report', 'actor'])
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
          })),
        )
        .execute()
    }

    return actionResult
  }

  async getActionsDueForReversal(): Promise<ModerationActionRow[]> {
    const actionsDueForReversal = await this.db.db
      .selectFrom('moderation_action')
      .where('durationInHours', 'is not', null)
      .where('expiresAt', '<', new Date().toISOString())
      .where('reversedAt', 'is', null)
      .selectAll()
      .execute()

    return actionsDueForReversal
  }

  async revertAction({
    id,
    createdBy,
    createdAt,
    reason,
  }: ReversibleModerationAction) {
    this.db.assertTransaction()
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

  async logReverseAction(
    info: ReversibleModerationAction,
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

  async takedownRepo(info: { takedownId: number; did: string }) {
    await this.db.db
      .updateTable('actor')
      .set({ takedownId: info.takedownId })
      .where('did', '=', info.did)
      .where('takedownId', 'is', null)
      .executeTakeFirst()
  }

  async reverseTakedownRepo(info: { did: string }) {
    await this.db.db
      .updateTable('actor')
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
    if (info.blobCids) {
      await Promise.all(
        info.blobCids.map(async (cid) => {
          const paths = ImageUriBuilder.presets.map((id) => {
            const uri = this.imgUriBuilder.getPresetUri(id, info.uri.host, cid)
            return uri.replace(this.imgUriBuilder.endpoint, '')
          })
          await this.imgInvalidator.invalidate(cid.toString(), paths)
        }),
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
    subject: { did: string } | { uri: AtUri; cid: CID }
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
      // Allowing dids that may not exist: may not be known yet to appview but needs to remain reportable.
      subjectInfo = {
        subjectType: 'com.atproto.admin.defs#repoRef',
        subjectDid: subject.did,
        subjectUri: null,
        subjectCid: null,
      }
    } else {
      // Allowing records/blobs that may not exist: may not be known yet to appview but needs to remain reportable.
      subjectInfo = {
        subjectType: 'com.atproto.repo.strongRef',
        subjectDid: subject.uri.host,
        subjectUri: subject.uri.toString(),
        subjectCid: subject.cid.toString(),
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
export type ReversibleModerationAction = Pick<
  ModerationActionRow,
  'id' | 'createdBy' | 'reason'
> & {
  createdAt?: Date
}

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
