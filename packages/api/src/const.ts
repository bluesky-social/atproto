import { LabelPreference } from './moderation/types'

export const BSKY_MODSERVICE_DID = 'did:plc:ar7c4by46qjdydhdevvrndac'

export const DEFAULT_LABELGROUP_PREFERENCES: Record<string, LabelPreference> = {
  porn: 'hide',
  nudity: 'warn',
  suggestive: 'warn',
  violence: 'warn',
  hate: 'hide',
  spam: 'hide',
  misinfo: 'warn',
}
