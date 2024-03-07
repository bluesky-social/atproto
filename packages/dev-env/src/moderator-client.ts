import AtpAgent, {
  ComAtprotoAdminEmitModerationEvent as EmitModerationEvent,
  ComAtprotoAdminQueryModerationStatuses as QueryModerationStatuses,
  ComAtprotoAdminQueryModerationEvents as QueryModerationEvents,
} from '@atproto/api'
import { TestOzone } from './ozone'

type TakeActionInput = EmitModerationEvent.InputSchema
type QueryStatusesParams = QueryModerationStatuses.QueryParams
type QueryEventsParams = QueryModerationEvents.QueryParams
type ModLevel = 'admin' | 'moderator' | 'triage'

export class ModeratorClient {
  agent: AtpAgent
  constructor(public ozone: TestOzone) {
    this.agent = ozone.getClient()
  }

  async getEvent(id: number, role?: ModLevel) {
    const result = await this.agent.api.com.atproto.admin.getModerationEvent(
      { id },
      {
        headers: await this.ozone.modHeaders(role),
      },
    )
    return result.data
  }

  async queryModerationStatuses(input: QueryStatusesParams, role?: ModLevel) {
    const result =
      await this.agent.api.com.atproto.admin.queryModerationStatuses(input, {
        headers: await this.ozone.modHeaders(role),
      })
    return result.data
  }

  async queryModerationEvents(input: QueryEventsParams, role?: ModLevel) {
    const result = await this.agent.api.com.atproto.admin.queryModerationEvents(
      input,
      {
        headers: await this.ozone.modHeaders(role),
      },
    )
    return result.data
  }

  async emitModerationEvent(
    opts: {
      event: TakeActionInput['event']
      subject: TakeActionInput['subject']
      subjectBlobCids?: TakeActionInput['subjectBlobCids']
      reason?: string
      createdBy?: string
      meta?: TakeActionInput['meta']
    },
    role?: ModLevel,
  ) {
    const {
      event,
      subject,
      subjectBlobCids,
      reason = 'X',
      createdBy = 'did:example:admin',
    } = opts
    const result = await this.agent.api.com.atproto.admin.emitModerationEvent(
      { event, subject, subjectBlobCids, createdBy, reason },
      {
        encoding: 'application/json',
        headers: await this.ozone.modHeaders(role),
      },
    )
    return result.data
  }

  async reverseModerationAction(
    opts: {
      id: number
      subject: TakeActionInput['subject']
      reason?: string
      createdBy?: string
    },
    role?: ModLevel,
  ) {
    const { subject, reason = 'X', createdBy = 'did:example:admin' } = opts
    const result = await this.agent.api.com.atproto.admin.emitModerationEvent(
      {
        subject,
        event: {
          $type: 'com.atproto.admin.defs#modEventReverseTakedown',
          comment: reason,
        },
        createdBy,
      },
      {
        encoding: 'application/json',
        headers: await this.ozone.modHeaders(role),
      },
    )
    return result.data
  }

  async performTakedown(
    opts: {
      subject: TakeActionInput['subject']
      subjectBlobCids?: TakeActionInput['subjectBlobCids']
      durationInHours?: number
      reason?: string
    },
    role?: ModLevel,
  ) {
    const { durationInHours, ...rest } = opts
    return this.emitModerationEvent(
      {
        event: {
          $type: 'com.atproto.admin.defs#modEventTakedown',
          durationInHours,
        },
        ...rest,
      },
      role,
    )
  }

  async performReverseTakedown(
    opts: {
      subject: TakeActionInput['subject']
      subjectBlobCids?: TakeActionInput['subjectBlobCids']
      reason?: string
    },
    role?: ModLevel,
  ) {
    return this.emitModerationEvent(
      {
        event: {
          $type: 'com.atproto.admin.defs#modEventReverseTakedown',
        },
        ...opts,
      },
      role,
    )
  }
}
