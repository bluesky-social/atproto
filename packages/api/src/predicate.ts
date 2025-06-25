import { AppBskyActorDefs, AppBskyActorProfile } from './client/index'
import { asPredicate } from './client/util'

export const isValidProfile = asPredicate(AppBskyActorProfile.validateRecord)
export const isValidAdultContentPref = asPredicate(
  AppBskyActorDefs.validateAdultContentPref,
)
export const isValidBskyAppStatePref = asPredicate(
  AppBskyActorDefs.validateBskyAppStatePref,
)
export const isValidContentLabelPref = asPredicate(
  AppBskyActorDefs.validateContentLabelPref,
)
export const isValidFeedViewPref = asPredicate(
  AppBskyActorDefs.validateFeedViewPref,
)
export const isValidHiddenPostsPref = asPredicate(
  AppBskyActorDefs.validateHiddenPostsPref,
)
export const isValidInterestsPref = asPredicate(
  AppBskyActorDefs.validateInterestsPref,
)
export const isValidLabelersPref = asPredicate(
  AppBskyActorDefs.validateLabelersPref,
)
export const isValidMutedWordsPref = asPredicate(
  AppBskyActorDefs.validateMutedWordsPref,
)
export const isValidPersonalDetailsPref = asPredicate(
  AppBskyActorDefs.validatePersonalDetailsPref,
)
export const isValidPostInteractionSettingsPref = asPredicate(
  AppBskyActorDefs.validatePostInteractionSettingsPref,
)
export const isValidSavedFeedsPref = asPredicate(
  AppBskyActorDefs.validateSavedFeedsPref,
)
export const isValidSavedFeedsPrefV2 = asPredicate(
  AppBskyActorDefs.validateSavedFeedsPrefV2,
)
export const isValidThreadViewPref = asPredicate(
  AppBskyActorDefs.validateThreadViewPref,
)
export const isValidVerificationPrefs = asPredicate(
  AppBskyActorDefs.validateVerificationPrefs,
)
