import AtpAgent from '@atproto/api'
import { InputSchema as TakeActionInput } from '@atproto/api/src/client/types/tools/ozone/moderation/emitEvent'
import { QueryParams as QueryStatusesParams } from '@atproto/api/src/client/types/tools/ozone/moderation/queryStatuses'
import { QueryParams as QueryEventsParams } from '@atproto/api/src/client/types/tools/ozone/moderation/queryEvents'
import { TestOzone } from './ozone'

type ModLevel = 'admin' | 'moderator' | 'triage'

export class ModeratorClient {
  agent: AtpAgent
  constructor(public ozone: TestOzone) {
    this.agent = ozone.getClient()
  }

  async getEvent(id: number, role?: ModLevel) {
    const result = await this.agent.api.tools.ozone.moderation.getEvent(
      { id },
      {
        headers: await this.ozone.modHeaders(role),
      },
    )
    return result.data
  }

  async queryStatuses(input: QueryStatusesParams, role?: ModLevel) {
    const result = await this.agent.api.tools.ozone.moderation.queryStatuses(
      input,
      {
        headers: await this.ozone.modHeaders(role),
      },
    )
    return result.data
  }

  async queryEvents(input: QueryEventsParams, role?: ModLevel) {
    const result = await this.agent.api.tools.ozone.moderation.queryEvents(
      input,
      {
        headers: await this.ozone.modHeaders(role),
      },
    )
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
    const result = await this.agent.api.tools.ozone.moderation.emitEvent(
      { event, subject, subjectBlobCids, createdBy, reason },
      {
        encoding: 'application/json',
        headers: await this.ozone.modHeaders(role),
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
    const result = await this.agent.api.tools.ozone.moderation.emitEvent(
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
    return this.emitEvent(
      {
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTakedown',
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
