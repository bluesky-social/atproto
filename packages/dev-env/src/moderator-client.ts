import {
  AtpAgent,
  ToolsOzoneModerationEmitEvent as EmitModerationEvent,
  ToolsOzoneModerationQueryStatuses as QueryModerationStatuses,
  ToolsOzoneModerationQueryEvents as QueryModerationEvents,
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
    const result = await this.agent.tools.ozone.moderation.getEvent(
      { id },
      {
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.getEvent',
          role,
        ),
      },
    )
    return result.data
  }

  async queryStatuses(input: QueryStatusesParams, role?: ModLevel) {
    const result = await this.agent.tools.ozone.moderation.queryStatuses(
      input,
      {
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.queryStatuses',
          role,
        ),
      },
    )
    return result.data
  }

  async queryEvents(input: QueryEventsParams, role?: ModLevel) {
    const result = await this.agent.tools.ozone.moderation.queryEvents(input, {
      headers: await this.ozone.modHeaders(
        'tools.ozone.moderation.queryEvents',
        role,
      ),
    })
    return result.data
  }

  async emitEvent(
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
    const result = await this.agent.tools.ozone.moderation.emitEvent(
      { event, subject, subjectBlobCids, createdBy, reason },
      {
        encoding: 'application/json',
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.emitEvent',
          role,
        ),
      },
    )
    return result.data
  }

  async reverseAction(
    opts: {
      id: number
      subject: TakeActionInput['subject']
      reason?: string
      createdBy?: string
    },
    role?: ModLevel,
  ) {
    const { subject, reason = 'X', createdBy = 'did:example:admin' } = opts
    const result = await this.agent.tools.ozone.moderation.emitEvent(
      {
        subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
          comment: reason,
        },
        createdBy,
      },
      {
        encoding: 'application/json',
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.emitEvent',
          role,
        ),
      },
    )
    return result.data
  }

  async performTakedown(
    opts: {
      subject: TakeActionInput['subject']
      subjectBlobCids?: TakeActionInput['subjectBlobCids']
      durationInHours?: number
      acknowledgeAccountSubjects?: boolean
      reason?: string
    },
    role?: ModLevel,
  ) {
    const { durationInHours, acknowledgeAccountSubjects, ...rest } = opts
    return this.emitEvent(
      {
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
          acknowledgeAccountSubjects,
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
}
