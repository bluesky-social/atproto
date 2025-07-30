import {
  AtpAgent,
  ToolsOzoneModerationDefs,
  ToolsOzoneModerationEmitEvent as EmitModerationEvent,
  ToolsOzoneModerationQueryEvents as QueryModerationEvents,
  ToolsOzoneModerationQueryStatuses as QueryModerationStatuses,
  ToolsOzoneSettingRemoveOptions,
  ToolsOzoneSettingUpsertOption,
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

  async getReporterStats(dids: string[]) {
    const result = await this.agent.tools.ozone.moderation.getReporterStats(
      { dids },
      {
        headers: await this.ozone.modHeaders(
          'tools.ozone.moderation.getReporterStats',
          'admin',
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
      meta?: unknown
      modTool?: ToolsOzoneModerationDefs.ModTool
      externalId?: string
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
    } = opts
    const result = await this.agent.tools.ozone.moderation.emitEvent(
      {
        event,
        subject,
        subjectBlobCids,
        createdBy,
        modTool,
        externalId,
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

  async reverseAction(
    opts: {
      id: number
      subject: TakeActionInput['subject']
      reason?: string
      createdBy?: string
      modTool?: ToolsOzoneModerationDefs.ModTool
    },
    role?: ModLevel,
  ) {
    const {
      subject,
      reason = 'X',
      createdBy = 'did:example:admin',
      modTool,
    } = opts
    const result = await this.agent.tools.ozone.moderation.emitEvent(
      {
        subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
          comment: reason,
        },
        createdBy,
        modTool,
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

  async upsertSettingOption(
    setting: ToolsOzoneSettingUpsertOption.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'admin',
  ) {
    const { data } = await this.agent.tools.ozone.setting.upsertOption(
      setting,
      {
        encoding: 'application/json',
        headers: await this.ozone.modHeaders(
          'tools.ozone.setting.upsertOption',
          callerRole,
        ),
      },
    )

    return data
  }

  async removeSettingOptions(
    params: ToolsOzoneSettingRemoveOptions.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'admin',
  ) {
    const { data } = await this.agent.tools.ozone.setting.removeOptions(
      params,
      {
        encoding: 'application/json',
        headers: await this.ozone.modHeaders(
          'tools.ozone.setting.removeOptions',
          callerRole,
        ),
      },
    )

    return data
  }
}
