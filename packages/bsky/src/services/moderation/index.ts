import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { PrimaryDatabase } from '../../db'
import { ModerationViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { ImageInvalidator } from '../../image/invalidator'
import {
  ACKNOWLEDGE,
  ActionMeta,
  ESCALATE,
  FLAG,
  REPORT,
  REVERT,
  TAKEDOWN,
} from '../../lexicon/types/com/atproto/admin/defs'
import { addHoursToDate } from '../../util/date'
import { adjustModerationSubjectStatus } from './status'
import {
  ModerationEventRow,
  ModerationSubjectStatusRow,
  ReversibleModerationEvent,
  SubjectInfo,
} from './types'

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

  async getEvent(id: number): Promise<ModerationEventRow | undefined> {
    return await this.db.db
      .selectFrom('moderation_event')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async getEventOrThrow(id: number): Promise<ModerationEventRow> {
    const event = await this.getEvent(id)
    if (!event) throw new InvalidRequestError('Moderation event not found')
    return event
  }

  async getEvents(opts: {
    subject?: string
    limit: number
    cursor?: string
  }): Promise<ModerationEventRow[]> {
    const { subject, limit, cursor } = opts
    let builder = this.db.db.selectFrom('moderation_event')
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

  async getReport(id: number): Promise<ModerationEventRow | undefined> {
    return await this.db.db
      .selectFrom('moderation_event')
      .where('action', '=', REPORT)
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  }

  async getCurrentStatus(
    subject: { did: string } | { uri: AtUri } | { cids: CID[] },
  ) {
    let builder = this.db.db.selectFrom('moderation_subject_status').selectAll()
    if ('did' in subject) {
      builder = builder.where('did', '=', subject.did)
    } else if ('uri' in subject) {
      builder = builder.where('recordPath', '=', subject.uri.toString())
    }
    // TODO: Handle the cid status
    return await builder.execute()
  }

  // May be we don't need this anymore?
  async getCurrentActions(
    subject: { did: string } | { uri: AtUri } | { cids: CID[] },
  ) {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db
      .selectFrom('moderation_event')
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
    action: ModerationEventRow['action']
    subject: { did: string } | { uri: AtUri; cid: CID }
    subjectBlobCids?: CID[]
    comment: string | null
    createLabelVals?: string[]
    negateLabelVals?: string[]
    createdBy: string
    createdAt?: Date
    durationInHours?: number
    refEventId?: number
    meta?: ActionMeta | null
  }): Promise<ModerationEventRow> {
    this.db.assertTransaction()
    const {
      action,
      createdBy,
      comment,
      subject,
      subjectBlobCids,
      durationInHours,
      refEventId,
      meta,
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

    const actionResult = await this.db.db
      .insertInto('moderation_event')
      .values({
        action,
        comment,
        createdAt: createdAt.toISOString(),
        createdBy,
        createLabelVals,
        negateLabelVals,
        durationInHours,
        refEventId,
        meta,
        expiresAt:
          durationInHours !== undefined
            ? addHoursToDate(durationInHours, createdAt).toISOString()
            : undefined,
        ...subjectInfo,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    if (subjectBlobCids?.length && !('did' in subject)) {
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

    try {
      await adjustModerationSubjectStatus(this.db, actionResult)
    } catch (err) {
      console.error(err)
    }

    // if ([ACKNOWLEDGE, TAKEDOWN, FLAG, ESCALATE].includes(action)) {
    //   const reportIdsToBeResolved = await getReportIdsToBeResolved(
    //     this.db,
    //     subjectInfo,
    //   )
    // TODO: We don't need to keep track of individual report resolutions
    // if (reportIdsToBeResolved.length) {
    //   try {
    //     await this.resolveReports({
    //       reportIds: reportIdsToBeResolved,
    //       actionId: actionResult.id,
    //       createdBy: actionResult.createdBy,
    //     })
    //   } catch (err) {
    //     console.error(err)
    //   }
    // }
    // }
    // if (action === REVERT) {
    // TODO: We don't need to keep track of individual report resolutions
    // const reportIdsToBeResolved = await getReportIdsToBeResolved(
    //   this.db,
    //   subjectInfo,
    // )
    // if (reportIdsToBeResolved.length) {
    //   await this.resolveReports({
    //     reportIds: reportIdsToBeResolved,
    //     actionId: actionResult.id,
    //     createdBy: actionResult.createdBy,
    //   })
    // }
    // }

    return actionResult
  }

  async getActionsDueForReversal(): Promise<ModerationEventRow[]> {
    const actionsDueForReversal = await this.db.db
      .selectFrom('moderation_event')
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
    comment,
    subject,
  }: ReversibleModerationEvent) {
    this.db.assertTransaction()
    const result = await this.logAction({
      refEventId: id,
      action: REVERT,
      createdAt,
      createdBy,
      comment,
      subject,
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

  async report(info: {
    reasonType: NonNullable<ModerationEventRow['meta']>['reportType']
    reason?: string
    subject: { did: string } | { uri: AtUri; cid: CID }
    reportedBy: string
    createdAt?: Date
  }): Promise<ModerationEventRow> {
    const {
      reasonType,
      reason,
      reportedBy,
      createdAt = new Date(),
      subject,
    } = info

    const event = await this.logAction({
      action: REPORT,
      meta: { reportType: reasonType },
      comment: reason || null,
      createdBy: reportedBy,
      subject,
      createdAt,
    })

    return event
  }

  async getSubjectStatuses({
    cursor,
    limit = 50,
    reviewState,
    reviewedAfter,
    reviewedBefore,
    reportedAfter,
    reportedBefore,
    includeMuted,
    subject,
  }: {
    cursor?: string
    limit?: number
    reviewedBefore?: string
    reviewState?: ModerationSubjectStatusRow['reviewState']
    reviewedAfter?: string
    reportedAfter?: string
    reportedBefore?: string
    includeMuted?: boolean
    subject?: string
  }) {
    let builder = this.db.db.selectFrom('moderation_subject_status')

    if (subject) {
      builder = builder.where((qb) => {
        return qb
          .where('did', '=', subject)
          .orWhere('recordPath', '=', subject)
          .orWhere('recordCid', '=', subject)
      })
    }

    if (reviewState) {
      builder = builder.where('reviewState', '=', reviewState)
    }

    if (reviewedAfter) {
      builder = builder.where('lastReviewedAt', '>', reviewedAfter)
    }

    if (reviewedBefore) {
      builder = builder.where('lastReviewedAt', '<', reviewedBefore)
    }

    if (reportedAfter) {
      builder = builder.where('lastReviewedAt', '>', reportedAfter)
    }

    if (reportedBefore) {
      builder = builder.where('lastReportedAt', '<', reportedBefore)
    }

    if (!includeMuted) {
      builder = builder.where('muteUntil', '<', new Date().toISOString())
    }

    if (cursor) {
      const cursorNumeric = parseInt(cursor, 10)
      if (isNaN(cursorNumeric)) {
        throw new InvalidRequestError('Malformed cursor')
      }
      builder = builder.where('id', '<', cursorNumeric)
    }

    const results = await builder.limit(limit).selectAll().execute()
    return results
  }
}
