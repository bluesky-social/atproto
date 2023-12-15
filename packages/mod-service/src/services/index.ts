import AtpAgent from '@atproto/api'
import { ModerationService } from './moderation'
import { FromDb } from './types'

export function createServices(appviewAgent: AtpAgent): Services {
  return {
    moderation: ModerationService.creator(appviewAgent),
  }
}

export type Services = {
  moderation: FromDb<ModerationService>
}
