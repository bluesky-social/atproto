import type { Client, DidString, l } from '@atproto/lex'
import { tools } from './lexicons/index.js'
import type { TestOzone } from './ozone.js'

type EmitEventInput = tools.ozone.moderation.emitEvent.$InputBody
// `$Params` is the *parsed* shape, in which defaulted params are required.
// Callers supply the pre-parse shape, so infer that from the schema instead.
export type QueryStatusesParams = l.InferInput<
  typeof tools.ozone.moderation.queryStatuses.$params
>
export type QueryEventsParams = l.InferInput<
  typeof tools.ozone.moderation.queryEvents.$params
>
export type QueryReportsParams = l.InferInput<
  typeof tools.ozone.report.queryReports.$params
>
type ModLevel = 'admin' | 'moderator' | 'triage'

/**
 * `emitEvent` takes an open union that only closes over `repoRef` and
 * `strongRef`. Anything else — chat convo & message refs, or a subject a test
 * builds by hand — lands in the `Unknown$Type` branch, which needs a cast. Keep
 * that cast here rather than at every call site, and narrow once, where the
 * request is built.
 */
type EventSubject =
  | EmitEventInput['subject']
  // Both forms are needed: the index signature lets an inline literal carry the
  // ref's own fields past the excess-property check, and the bare form accepts
  // a value already typed as `{ $type: string }` by a test helper.
  | { $type: string; [k: string]: unknown }
  | { $type: string }

export class ModeratorClient {
  client: Client
  constructor(public ozone: TestOzone) {
    this.client = ozone.getClient()
  }

  async getEvent(id: number, role?: ModLevel) {
    return this.client.call(
      tools.ozone.moderation.getEvent,
      { id },
      {
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.getEvent',
          role,
        ),
      },
    )
  }

  async queryStatuses(input: QueryStatusesParams, role?: ModLevel) {
    return this.client.call(tools.ozone.moderation.queryStatuses, input, {
      headers: await this.ozone.modHeaders(
        'tools.ozone.moderation.queryStatuses',
        role,
      ),
    })
  }

  async getReporterStats(dids: DidString[]) {
    return this.client.call(
      tools.ozone.moderation.getReporterStats,
      { dids },
      {
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.getReporterStats',
          'admin',
        ),
      },
    )
  }

  async queryEvents(input: QueryEventsParams, role?: ModLevel) {
    return this.client.call(tools.ozone.moderation.queryEvents, input, {
      headers: await this.ozone.modHeaders(
        'tools.ozone.moderation.queryEvents',
        role,
      ),
    })
  }

  async queryReports(input: QueryReportsParams, role?: ModLevel) {
    return this.client.call(tools.ozone.report.queryReports, input, {
      headers: await this.ozone.modHeaders(
        'tools.ozone.report.queryReports',
        role,
      ),
    })
  }

  async emitEvent(
    opts: {
      event: EmitEventInput['event']
      subject: EventSubject
      subjectBlobCids?: EmitEventInput['subjectBlobCids']
      reason?: string
      createdBy?: DidString
      meta?: unknown
      modTool?: tools.ozone.moderation.defs.ModTool
      externalId?: string
      reportAction?: EmitEventInput['reportAction']
    },
    role?: ModLevel,
  ) {
    const {
      event,
      subject,
      subjectBlobCids,
      createdBy = 'did:example:admin',
      modTool,
      externalId,
      reportAction,
    } = opts
    return this.client.call(
      tools.ozone.moderation.emitEvent,
      {
        event,
        subject: subject as EmitEventInput['subject'],
        subjectBlobCids,
        createdBy,
        modTool,
        externalId,
        reportAction,
      },
      {
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.emitEvent',
          role,
        ),
      },
    )
  }

  async reverseAction(
    opts: {
      id: number
      subject: EventSubject
      reason?: string
      createdBy?: DidString
      modTool?: tools.ozone.moderation.defs.ModTool
    },
    role?: ModLevel,
  ) {
    const {
      subject,
      reason = 'X',
      createdBy = 'did:example:admin',
      modTool,
    } = opts
    return this.client.call(
      tools.ozone.moderation.emitEvent,
      {
        subject: subject as EmitEventInput['subject'],
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
          comment: reason,
        },
        createdBy,
        modTool,
      },
      {
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.emitEvent',
          role,
        ),
      },
    )
  }

  async performTakedown(
    opts: {
      subject: EventSubject
      subjectBlobCids?: EmitEventInput['subjectBlobCids']
      durationInHours?: number
      acknowledgeAccountSubjects?: boolean
      reason?: string
      policies?: string[]
    },
    role?: ModLevel,
  ) {
    const { durationInHours, acknowledgeAccountSubjects, policies, ...rest } =
      opts
    return this.emitEvent(
      {
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
          acknowledgeAccountSubjects,
          durationInHours,
          policies,
        },
        ...rest,
      },
      role,
    )
  }

  async performReverseTakedown(
    opts: {
      subject: EventSubject
      subjectBlobCids?: EmitEventInput['subjectBlobCids']
      reason?: string
    },
    role?: ModLevel,
  ) {
    return this.emitEvent(
      {
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        },
        ...opts,
      },
      role,
    )
  }

  async upsertSettingOption(
    setting: tools.ozone.setting.upsertOption.$InputBody,
    callerRole: ModLevel = 'admin',
  ) {
    return this.client.call(tools.ozone.setting.upsertOption, setting, {
      headers: await this.ozone.modHeaders(
        'tools.ozone.setting.upsertOption',
        callerRole,
      ),
    })
  }

  async removeSettingOptions(
    params: tools.ozone.setting.removeOptions.$InputBody,
    callerRole: ModLevel = 'admin',
  ) {
    return this.client.call(tools.ozone.setting.removeOptions, params, {
      headers: await this.ozone.modHeaders(
        'tools.ozone.setting.removeOptions',
        callerRole,
      ),
    })
  }

  async computeStats() {
    const db = this.ozone.ctx.db
    const statsService = this.ozone.ctx.reportStatsService(db)
    await statsService.materializeAll({ force: true })
  }
}
