import { Selectable } from 'kysely'
import { ArrayEl } from '@atproto/common'
import { AtUri } from '@atproto/syntax'
import { INVALID_HANDLE } from '@atproto/syntax'
import { BlobRef, jsonStringToLex } from '@atproto/lexicon'
import { Database } from '../../db'
import { Actor } from '../../db/tables/actor'
import { Record as RecordRow } from '../../db/tables/record'
import { ModerationEvent } from '../../db/tables/moderation'
import {
  RepoView,
  RepoViewDetail,
  RecordView,
  RecordViewDetail,
  ActionView,
  ActionViewDetail,
  ReportView,
  ReportViewDetail,
  BlobView,
  SubjectStatusView,
} from '../../lexicon/types/com/atproto/admin/defs'
import { OutputSchema as ReportOutput } from '../../lexicon/types/com/atproto/moderation/createReport'
import { Label } from '../../lexicon/types/com/atproto/label/defs'
import {
  ModerationEventRowWithHandle,
  ModerationSubjectStatusRow,
} from './types'
import { getSelfLabels } from '../label'
import { REASONOTHER } from '../../lexicon/types/com/atproto/moderation/defs'

export class ModerationViews {
  constructor(private db: Database) {}

  repo(result: RepoResult): Promise<RepoView>
  repo(result: RepoResult[]): Promise<RepoView[]>
  async repo(
    result: RepoResult | RepoResult[],
  ): Promise<RepoView | RepoView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const [info, actionResults] = await Promise.all([
      await this.db.db
        .selectFrom('actor')
        .leftJoin('profile', 'profile.creator', 'actor.did')
        .leftJoin(
          'record as profile_record',
          'profile_record.uri',
          'profile.uri',
        )
        .where(
          'actor.did',
          'in',
          results.map((r) => r.did),
        )
        .select(['actor.did as did', 'profile_record.json as profileJson'])
        .execute(),
      this.db.db
        .selectFrom('moderation_event')
        .where('reversedAt', 'is', null)
        .where('subjectType', '=', 'com.atproto.admin.defs#repoRef')
        .where(
          'subjectDid',
          'in',
          results.map((r) => r.did),
        )
        .select(['id', 'action', 'durationInHours', 'subjectDid'])
        .execute(),
    ])

    const infoByDid = info.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof info>>,
    )
    const actionByDid = actionResults.reduce(
      (acc, cur) => Object.assign(acc, { [cur.subjectDid ?? '']: cur }),
      {} as Record<string, ArrayEl<typeof actionResults>>,
    )

    const views = results.map((r) => {
      const { profileJson } = infoByDid[r.did] ?? {}
      const action = actionByDid[r.did]
      const relatedRecords: object[] = []
      if (profileJson) {
        relatedRecords.push(
          jsonStringToLex(profileJson) as Record<string, unknown>,
        )
      }
      return {
        // No email or invite info on appview
        did: r.did,
        handle: r.handle ?? INVALID_HANDLE,
        relatedRecords,
        indexedAt: r.indexedAt,
        moderation: {
          currentAction: action
            ? {
                id: action.id,
                action: action.action,
                durationInHours: action.durationInHours ?? undefined,
              }
            : undefined,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }
  action(result: ActionResult): Promise<ActionView>
  action(result: ActionResult[]): Promise<ActionView[]>
  async action(
    result: ActionResult | ActionResult[],
  ): Promise<ActionView | ActionView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const views = results.map((res) => ({
      id: res.id,
      action: res.action,
      durationInHours: res.durationInHours ?? undefined,
      subject:
        res.subjectType === 'com.atproto.admin.defs#repoRef'
          ? {
              $type: 'com.atproto.admin.defs#repoRef',
              did: res.subjectDid,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
              uri: res.subjectUri,
              cid: res.subjectCid,
            },
      // TODO: do we need this?
      subjectBlobCids: [],
      comment: res.comment || undefined,
      createdAt: res.createdAt,
      createdBy: res.createdBy,
      createLabelVals:
        res.createLabelVals && res.createLabelVals.length > 0
          ? res.createLabelVals.split(' ')
          : undefined,
      negateLabelVals:
        res.negateLabelVals && res.negateLabelVals.length > 0
          ? res.negateLabelVals.split(' ')
          : undefined,
      reversal:
        res.reversedAt !== null &&
        res.reversedBy !== null &&
        res.reversedReason !== null
          ? {
              createdAt: res.reversedAt,
              createdBy: res.reversedBy,
              reason: res.reversedReason,
            }
          : undefined,
    }))

    return Array.isArray(result) ? views : views[0]
  }
  async repoDetail(result: RepoResult): Promise<RepoViewDetail> {
    const repo = await this.repo(result)
    const labels = await this.labels(repo.did)

    return {
      ...repo,
      moderation: {
        ...repo.moderation,
      },
      labels,
    }
  }

  record(result: RecordResult): Promise<RecordView>
  record(result: RecordResult[]): Promise<RecordView[]>
  async record(
    result: RecordResult | RecordResult[],
  ): Promise<RecordView | RecordView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const [repoResults, actionResults] = await Promise.all([
      this.db.db
        .selectFrom('actor')
        .where(
          'actor.did',
          'in',
          results.map((r) => didFromUri(r.uri)),
        )
        .selectAll()
        .execute(),
      this.db.db
        .selectFrom('moderation_event')
        .where('reversedAt', 'is', null)
        .where('subjectType', '=', 'com.atproto.repo.strongRef')
        .where(
          'subjectUri',
          'in',
          results.map((r) => r.uri),
        )
        .select(['id', 'action', 'durationInHours', 'subjectUri'])
        .execute(),
    ])
    const repos = await this.repo(repoResults)

    const reposByDid = repos.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof repos>>,
    )
    const actionByUri = actionResults.reduce(
      (acc, cur) => Object.assign(acc, { [cur.subjectUri ?? '']: cur }),
      {} as Record<string, ArrayEl<typeof actionResults>>,
    )

    const views = results.map((res) => {
      const repo = reposByDid[didFromUri(res.uri)]
      const action = actionByUri[res.uri]
      if (!repo) throw new Error(`Record repo is missing: ${res.uri}`)
      const value = jsonStringToLex(res.json) as Record<string, unknown>
      return {
        uri: res.uri,
        cid: res.cid,
        value,
        blobCids: findBlobRefs(value).map((blob) => blob.ref.toString()),
        indexedAt: res.indexedAt,
        repo,
        moderation: {
          currentAction: action
            ? {
                id: action.id,
                action: action.action,
                durationInHours: action.durationInHours ?? undefined,
              }
            : undefined,
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  async recordDetail(result: RecordResult): Promise<RecordViewDetail> {
    const [record, subjectStatusResult] = await Promise.all([
      this.record(result),
      this.db.db
        .selectFrom('moderation_subject_status')
        // TODO: We need to build the path manually here, right?
        .where('recordPath', '=', result.uri)
        .orderBy('id', 'desc')
        .selectAll()
        .executeTakeFirst(),
    ])
    const [blobs, labels, subjectStatus] = await Promise.all([
      this.blob(findBlobRefs(record.value)),
      this.labels(record.uri),
      subjectStatusResult
        ? this.subjectStatus(subjectStatusResult)
        : Promise.resolve(undefined),
    ])
    const selfLabels = getSelfLabels({
      uri: result.uri,
      cid: result.cid,
      record: jsonStringToLex(result.json) as Record<string, unknown>,
    })
    return {
      ...record,
      blobs,
      moderation: {
        ...record.moderation,
        subjectStatus,
      },
      labels: [...labels, ...selfLabels],
    }
  }
  reportPublic(report: ReportResult): ReportOutput {
    return {
      id: report.id,
      createdAt: report.createdAt,
      // Ideally, we would never have a report entry that does not have a reasonType but at the schema level
      // we are not guarantying that so in whatever case, if we end up with such entries, default to 'other'
      reasonType: report.meta?.reportType || REASONOTHER,
      reason: report.comment ?? undefined,
      reportedBy: report.createdBy,
      subject:
        report.subjectType === 'com.atproto.admin.defs#repoRef'
          ? {
              $type: 'com.atproto.admin.defs#repoRef',
              did: report.subjectDid,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
              uri: report.subjectUri,
              cid: report.subjectCid,
            },
    }
  }
  // Partial view for subjects

  async subject(result: SubjectResult): Promise<SubjectView> {
    let subject: SubjectView
    if (result.subjectType === 'com.atproto.admin.defs#repoRef') {
      const repoResult = await this.db.db
        .selectFrom('actor')
        .selectAll()
        .where('did', '=', result.subjectDid)
        .executeTakeFirst()
      if (repoResult) {
        subject = await this.repo(repoResult)
        subject.$type = 'com.atproto.admin.defs#repoView'
      } else {
        subject = { did: result.subjectDid }
        subject.$type = 'com.atproto.admin.defs#repoViewNotFound'
      }
    } else if (
      result.subjectType === 'com.atproto.repo.strongRef' &&
      result.subjectUri !== null
    ) {
      const recordResult = await this.db.db
        .selectFrom('record')
        .selectAll()
        .where('uri', '=', result.subjectUri)
        .executeTakeFirst()
      if (recordResult) {
        subject = await this.record(recordResult)
        subject.$type = 'com.atproto.admin.defs#recordView'
      } else {
        subject = { uri: result.subjectUri }
        subject.$type = 'com.atproto.admin.defs#recordViewNotFound'
      }
    } else {
      throw new Error(`Bad subject data: (${result.id}) ${result.subjectType}`)
    }
    return subject
  }

  // Partial view for blobs

  async blob(blobs: BlobRef[]): Promise<BlobView[]> {
    if (!blobs.length) return []
    const actionResults = await this.db.db
      .selectFrom('moderation_event')
      .where('reversedAt', 'is', null)
      .innerJoin(
        'moderation_action_subject_blob as subject_blob',
        'subject_blob.actionId',
        'moderation_event.id',
      )
      .where(
        'subject_blob.cid',
        'in',
        blobs.map((blob) => blob.ref.toString()),
      )
      .select(['id', 'action', 'durationInHours', 'cid'])
      .execute()
    const actionByCid = actionResults.reduce(
      (acc, cur) => Object.assign(acc, { [cur.cid]: cur }),
      {} as Record<string, ArrayEl<typeof actionResults>>,
    )
    // Intentionally missing details field, since we don't have any on appview.
    // We also don't know when the blob was created, so we use a canned creation time.
    const unknownTime = new Date(0).toISOString()
    return blobs.map((blob) => {
      const cid = blob.ref.toString()
      const action = actionByCid[cid]
      return {
        cid,
        mimeType: blob.mimeType,
        size: blob.size,
        createdAt: unknownTime,
        moderation: {
          currentAction: action
            ? {
                id: action.id,
                action: action.action,
                durationInHours: action.durationInHours ?? undefined,
              }
            : undefined,
        },
      }
    })
  }

  async labels(subject: string, includeNeg?: boolean): Promise<Label[]> {
    const res = await this.db.db
      .selectFrom('label')
      .where('label.uri', '=', subject)
      .if(!includeNeg, (qb) => qb.where('neg', '=', false))
      .selectAll()
      .execute()
    return res.map((l) => ({
      ...l,
      cid: l.cid === '' ? undefined : l.cid,
      neg: l.neg,
    }))
  }
  subjectStatus(result: ModerationSubjectStatusRow): Promise<SubjectStatusView>
  subjectStatus(
    result: ModerationSubjectStatusRow[],
  ): Promise<SubjectStatusView[]>
  async subjectStatus(
    result: ModerationSubjectStatusRow | ModerationSubjectStatusRow[],
  ): Promise<SubjectStatusView | SubjectStatusView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const decoratedSubjectStatuses = results.map((subjectStatus) => ({
      ...subjectStatus,
      subject: !subjectStatus.recordPath
        ? {
            $type: 'com.atproto.admin.defs#repoRef',
            did: subjectStatus.did,
          }
        : {
            $type: 'com.atproto.repo.strongRef',
            uri: subjectStatus.recordPath,
            cid: subjectStatus.recordCid,
          },
    }))

    // TODO: This is a hack to get the subject status to compile
    // @ts-ignore
    return Array.isArray(results)
      ? decoratedSubjectStatuses
      : decoratedSubjectStatuses[0]
  }
}

type RepoResult = Actor

type ActionResult = Selectable<ModerationEvent>

type ReportResult = ModerationEventRowWithHandle

type RecordResult = RecordRow

type SubjectResult = Pick<
  ActionResult & ReportResult,
  'id' | 'subjectType' | 'subjectDid' | 'subjectUri' | 'subjectCid'
>

type SubjectView = ActionViewDetail['subject'] & ReportViewDetail['subject']

function didFromUri(uri: string) {
  return new AtUri(uri).host
}

function findBlobRefs(value: unknown, refs: BlobRef[] = []) {
  if (value instanceof BlobRef) {
    refs.push(value)
  } else if (Array.isArray(value)) {
    value.forEach((val) => findBlobRefs(val, refs))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((val) => findBlobRefs(val, refs))
  }
  return refs
}
