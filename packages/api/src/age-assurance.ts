import { AppBskyAgeassuranceDefs } from './client'
import { ids } from './client/lexicons'

export type AgeAssuranceRuleID = Exclude<
  | AppBskyAgeassuranceDefs.ConfigRegionRuleDefault['$type']
  | AppBskyAgeassuranceDefs.ConfigRegionRuleIfDeclaredOverAge['$type']
  | AppBskyAgeassuranceDefs.ConfigRegionRuleIfDeclaredUnderAge['$type']
  | AppBskyAgeassuranceDefs.ConfigRegionRuleIfAssuredOverAge['$type']
  | AppBskyAgeassuranceDefs.ConfigRegionRuleIfAssuredUnderAge['$type']
  | AppBskyAgeassuranceDefs.ConfigRegionRuleIfAccountNewerThan['$type']
  | AppBskyAgeassuranceDefs.ConfigRegionRuleIfAccountOlderThan['$type'],
  undefined
>

export const ageAssuranceRuleIDs: Record<string, AgeAssuranceRuleID> = {
  Default: `${ids.AppBskyAgeassuranceDefs}#configRegionRuleDefault`,
  IfDeclaredOverAge: `${ids.AppBskyAgeassuranceDefs}#configRegionRuleIfDeclaredOverAge`,
  IfDeclaredUnderAge: `${ids.AppBskyAgeassuranceDefs}#configRegionRuleIfDeclaredUnderAge`,
  IfAssuredOverAge: `${ids.AppBskyAgeassuranceDefs}#configRegionRuleIfAssuredOverAge`,
  IfAssuredUnderAge: `${ids.AppBskyAgeassuranceDefs}#configRegionRuleIfAssuredUnderAge`,
  IfAccountNewerThan: `${ids.AppBskyAgeassuranceDefs}#configRegionRuleIfAccountNewerThan`,
  IfAccountOlderThan: `${ids.AppBskyAgeassuranceDefs}#configRegionRuleIfAccountOlderThan`,
}

/**
 * Returns the first matched region configuration based on the provided geolocation.
 */
export function getAgeAssuranceRegionConfig(
  config: AppBskyAgeassuranceDefs.Config,
  geolocation: {
    countryCode: string
    regionCode?: string
  },
): AppBskyAgeassuranceDefs.ConfigRegion | undefined {
  const { regions } = config
  return regions.find(({ countryCode, regionCode }) => {
    if (countryCode === geolocation.countryCode) {
      return !regionCode || regionCode === geolocation.regionCode
    }
  })
}

export function computeAgeAssuranceRegionAccess(
  region: AppBskyAgeassuranceDefs.ConfigRegion,
  data:
    | {
        /**
         * The account creation date in ISO 8601 format. Only checked if we
         * don't have an assured age, such as on the client.
         */
        accountCreatedAt?: string
        /**
         * The user's declared age
         */
        declaredAge?: number
        /**
         * The user's minimum age as assured by a trusted third party.
         */
        assuredAge?: number
      }
    | undefined,
):
  | {
      access: AppBskyAgeassuranceDefs.Access
      reason: AgeAssuranceRuleID
    }
  | undefined {
  // first match wins
  for (const rule of region.rules) {
    if (AppBskyAgeassuranceDefs.isConfigRegionRuleIfAccountNewerThan(rule)) {
      if (data?.accountCreatedAt && !data?.assuredAge) {
        const accountCreatedAt = new Date(data.accountCreatedAt)
        const threshold = new Date(rule.date)
        if (accountCreatedAt >= threshold) {
          return {
            access: rule.access,
            reason: rule.$type,
          }
        }
      }
    } else if (
      AppBskyAgeassuranceDefs.isConfigRegionRuleIfAccountOlderThan(rule)
    ) {
      if (data?.accountCreatedAt && !data?.assuredAge) {
        const accountCreatedAt = new Date(data.accountCreatedAt)
        const threshold = new Date(rule.date)
        if (accountCreatedAt < threshold) {
          return {
            access: rule.access,
            reason: rule.$type,
          }
        }
      }
    } else if (
      AppBskyAgeassuranceDefs.isConfigRegionRuleIfDeclaredOverAge(rule)
    ) {
      if (data?.declaredAge !== undefined && data.declaredAge >= rule.age) {
        return {
          access: rule.access,
          reason: rule.$type,
        }
      }
    } else if (
      AppBskyAgeassuranceDefs.isConfigRegionRuleIfDeclaredUnderAge(rule)
    ) {
      if (data?.declaredAge !== undefined && data.declaredAge < rule.age) {
        return {
          access: rule.access,
          reason: rule.$type,
        }
      }
    } else if (
      AppBskyAgeassuranceDefs.isConfigRegionRuleIfAssuredOverAge(rule)
    ) {
      if (data?.assuredAge && data.assuredAge >= rule.age) {
        return {
          access: rule.access,
          reason: rule.$type,
        }
      }
    } else if (
      AppBskyAgeassuranceDefs.isConfigRegionRuleIfAssuredUnderAge(rule)
    ) {
      if (data?.assuredAge && data.assuredAge < rule.age) {
        return {
          access: rule.access,
          reason: rule.$type,
        }
      }
    } else if (AppBskyAgeassuranceDefs.isConfigRegionRuleDefault(rule)) {
      return {
        access: rule.access,
        reason: rule.$type,
      }
    }
  }
}
