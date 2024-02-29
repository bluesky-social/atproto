import AtpAgent from '@atproto/api'
import { InputSchema as TakeActionInput } from '@atproto/api/src/client/types/com/atproto/admin/emitModerationEvent'
import { QueryParams as QueryStatusesParams } from '@atproto/api/src/client/types/com/atproto/admin/queryModerationStatuses'
import { QueryParams as QueryEventsParams } from '@atproto/api/src/client/types/com/atproto/admin/queryModerationEvents'
import { TestOzone } from './ozone'

export class ModeratorClient {
  agent: AtpAgent
  constructor(public ozone: TestOzone) {
    this.agent = ozone.getClient()
  }

  async getEvent(id: number) {
    const result = await this.agent.api.com.atproto.admin.getModerationEvent(
      { id },
      {
        headers: await this.ozone.modHeaders(),
      },
    )
    return result.data
  }

  async queryModerationStatuses(input: QueryStatusesParams) {
    const result =
      await this.agent.api.com.atproto.admin.queryModerationStatuses(input, {
        headers: await this.ozone.modHeaders(),
      })
    return result.data
  }

  async queryModerationEvents(input: QueryEventsParams) {
    const result = await this.agent.api.com.atproto.admin.queryModerationEvents(
      input,
      {
        headers: await this.ozone.modHeaders(),
      },
    )
    return result.data
  }

  async emitModerationEvent(opts: {
    event: TakeActionInput['event']
    subject: TakeActionInput['subject']
    reason?: string
    createdBy?: string
    meta?: TakeActionInput['meta']
  }) {
    const {
      event,
      subject,
      reason = 'X',
      createdBy = 'did:example:admin',
    } = opts
    const result = await this.agent.api.com.atproto.admin.emitModerationEvent(
      { event, subject, createdBy, reason },
      {
        encoding: 'application/json',
        headers: await this.ozone.modHeaders(),
      },
    )
    return result.data
  }

  async reverseModerationAction(opts: {
    id: number
    subject: TakeActionInput['subject']
    reason?: string
    createdBy?: string
  }) {
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
        headers: await this.ozone.modHeaders(),
      },
    )
    return result.data
  }
}
