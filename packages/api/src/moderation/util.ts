import {
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyLabelerDefs,
  ComAtprotoLabelDefs,
} from '../client'
import {
  InterpretedLabelValueDefinition,
  ModerationBehavior,
  LabelPreference,
  LabelValueDefinitionFlag,
} from './types'

export function isQuotedPost(embed: unknown): embed is AppBskyEmbedRecord.View {
  return Boolean(embed && AppBskyEmbedRecord.isView(embed))
}

export function isQuotedPostWithMedia(
  embed: unknown,
): embed is AppBskyEmbedRecordWithMedia.View {
  return Boolean(embed && AppBskyEmbedRecordWithMedia.isView(embed))
}

export function interpretLabelValueDefinition(
  def: ComAtprotoLabelDefs.LabelValueDefinition,
  definedBy: string | undefined,
): InterpretedLabelValueDefinition {
  const behaviors: {
    account: ModerationBehavior
    profile: ModerationBehavior
    content: ModerationBehavior
  } = {
    account: {},
    profile: {},
    content: {},
  }
  const alertOrInform: 'alert' | 'inform' | undefined =
    def.severity === 'alert'
      ? 'alert'
      : def.severity === 'inform'
        ? 'inform'
        : undefined
  if (def.blurs === 'content') {
    // target=account, blurs=content
    behaviors.account.profileList = alertOrInform
    behaviors.account.profileView = alertOrInform
    behaviors.account.contentList = 'blur'
    behaviors.account.contentView = def.adultOnly ? 'blur' : alertOrInform
    // target=profile, blurs=content
    behaviors.profile.profileList = alertOrInform
    behaviors.profile.profileView = alertOrInform
    // target=content, blurs=content
    behaviors.content.contentList = 'blur'
    behaviors.content.contentView = def.adultOnly ? 'blur' : alertOrInform
  } else if (def.blurs === 'media') {
    // target=account, blurs=media
    behaviors.account.profileList = alertOrInform
    behaviors.account.profileView = alertOrInform
    behaviors.account.avatar = 'blur'
    behaviors.account.banner = 'blur'
    // target=profile, blurs=media
    behaviors.profile.profileList = alertOrInform
    behaviors.profile.profileView = alertOrInform
    behaviors.profile.avatar = 'blur'
    behaviors.profile.banner = 'blur'
    // target=content, blurs=media
    behaviors.content.contentMedia = 'blur'
  } else if (def.blurs === 'none') {
    // target=account, blurs=none
    behaviors.account.profileList = alertOrInform
    behaviors.account.profileView = alertOrInform
    behaviors.account.contentList = alertOrInform
    behaviors.account.contentView = alertOrInform
    // target=profile, blurs=none
    behaviors.profile.profileList = alertOrInform
    behaviors.profile.profileView = alertOrInform
    // target=content, blurs=none
    behaviors.content.contentList = alertOrInform
    behaviors.content.contentView = alertOrInform
  }

  let defaultSetting: LabelPreference = 'warn'
  if (def.defaultSetting === 'hide' || def.defaultSetting === 'ignore') {
    defaultSetting = def.defaultSetting as LabelPreference
  }

  const flags: LabelValueDefinitionFlag[] = ['no-self']
  if (def.adultOnly) {
    flags.push('adult')
  }

  return {
    ...def,
    definedBy,
    configurable: true,
    defaultSetting,
    flags,
    behaviors,
  }
}

export function interpretLabelValueDefinitions(
  labelerView: AppBskyLabelerDefs.LabelerViewDetailed,
): InterpretedLabelValueDefinition[] {
  return (labelerView.policies?.labelValueDefinitions || [])
    .filter(
      (labelValDef) =>
        ComAtprotoLabelDefs.validateLabelValueDefinition(labelValDef).success,
    )
    .map((labelValDef) =>
      interpretLabelValueDefinition(labelValDef, labelerView.creator.did),
    )
}
