import { app } from '../../lexicons/index.js'

const defs = app.bsky.ageassurance.defs

export type AgeAssuranceRuleID =
  | typeof defs.configRegionRuleDefault.$type
  | typeof defs.configRegionRuleIfDeclaredOverAge.$type
  | typeof defs.configRegionRuleIfDeclaredUnderAge.$type
  | typeof defs.configRegionRuleIfAssuredOverAge.$type
  | typeof defs.configRegionRuleIfAssuredUnderAge.$type
  | typeof defs.configRegionRuleIfAccountNewerThan.$type
  | typeof defs.configRegionRuleIfAccountOlderThan.$type

export type AgeAssuranceRegionAccess = {
  access: app.bsky.ageassurance.defs.Access
  reason: AgeAssuranceRuleID
}

/**
 * Returns the first matched region configuration based on the provided
 * filters. Region configurations that declare `platforms` only match when the
 * provided platform is included in that list. If no platform filter is
 * provided, platform restrictions are ignored.
 */
export function getAgeAssuranceRegionConfig(
  config: app.bsky.ageassurance.defs.Config,
  filters: {
    countryCode: string
    regionCode?: string
    platform?: string
  },
): app.bsky.ageassurance.defs.ConfigRegion | undefined {
  const { regions } = config
  return regions.find(({ countryCode, regionCode, platforms }) => {
    if (
      filters.platform &&
      platforms?.length &&
      !platforms.includes(filters.platform)
    ) {
      return false
    }
    if (countryCode === filters.countryCode) {
      return !regionCode || regionCode === filters.regionCode
    }
  })
}

export function computeAgeAssuranceRegionAccess(
  region: app.bsky.ageassurance.defs.ConfigRegion,
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
): AgeAssuranceRegionAccess | undefined {
  // first match wins
  for (const rule of region.rules) {
    if (defs.configRegionRuleIfAccountNewerThan.$isTypeOf(rule)) {
      if (data?.accountCreatedAt && !data?.assuredAge) {
        const accountCreatedAt = new Date(data.accountCreatedAt)
        const threshold = new Date(rule.date)
        if (accountCreatedAt >= threshold) {
          return {
            access: rule.access,
            reason: defs.configRegionRuleIfAccountNewerThan.$type,
          }
        }
      }
    } else if (defs.configRegionRuleIfAccountOlderThan.$isTypeOf(rule)) {
      if (data?.accountCreatedAt && !data?.assuredAge) {
        const accountCreatedAt = new Date(data.accountCreatedAt)
        const threshold = new Date(rule.date)
        if (accountCreatedAt < threshold) {
          return {
            access: rule.access,
            reason: defs.configRegionRuleIfAccountOlderThan.$type,
          }
        }
      }
    } else if (defs.configRegionRuleIfDeclaredOverAge.$isTypeOf(rule)) {
      if (data?.declaredAge !== undefined && data.declaredAge >= rule.age) {
        return {
          access: rule.access,
          reason: defs.configRegionRuleIfDeclaredOverAge.$type,
        }
      }
    } else if (defs.configRegionRuleIfDeclaredUnderAge.$isTypeOf(rule)) {
      if (data?.declaredAge !== undefined && data.declaredAge < rule.age) {
        return {
          access: rule.access,
          reason: defs.configRegionRuleIfDeclaredUnderAge.$type,
        }
      }
    } else if (defs.configRegionRuleIfAssuredOverAge.$isTypeOf(rule)) {
      if (data?.assuredAge && data.assuredAge >= rule.age) {
        return {
          access: rule.access,
          reason: defs.configRegionRuleIfAssuredOverAge.$type,
        }
      }
    } else if (defs.configRegionRuleIfAssuredUnderAge.$isTypeOf(rule)) {
      if (data?.assuredAge && data.assuredAge < rule.age) {
        return {
          access: rule.access,
          reason: defs.configRegionRuleIfAssuredUnderAge.$type,
        }
      }
    } else if (defs.configRegionRuleDefault.$isTypeOf(rule)) {
      return {
        access: rule.access,
        reason: defs.configRegionRuleDefault.$type,
      }
    }
  }
}

/**
 * Compute age assurance access based on verified minimum age. Thrown errors
 * are internal errors, so handle them accordingly.
 */
export function computeAgeAssuranceAccessOrThrow(
  config: app.bsky.ageassurance.defs.Config,
  {
    countryCode,
    regionCode,
    verifiedMinimumAge,
  }: {
    countryCode: string
    regionCode?: string
    verifiedMinimumAge: number
  },
): AgeAssuranceRegionAccess {
  const region = getAgeAssuranceRegionConfig(config, {
    countryCode,
    regionCode,
  })

  if (region) {
    const result = computeAgeAssuranceRegionAccess(region, {
      assuredAge: verifiedMinimumAge,
      /*
       * We don't care about this here, this is a client-only rule. If we have
       * verified data, we can use that, and the account creation date is
       * irrelevant.
       */
      accountCreatedAt: undefined,
    })

    if (result) {
      return result
    } else {
      /*
       * If we don't get a result, it's because none of the rules matched,
       * which is a configuration error: there should always be a default
       * rule.
       */
      throw new Error('Cound not compute age assurance region access')
    }
  } else {
    /**
     * If we had geolocation data, but we don't have a region config for this
     * geolocation, then it means a user outside of our configured regions
     * has completed age verification. In this case, we can't determine their
     * access level, so we throw an error.
     *
     * This case is also guarded in `app.bsky.ageassurance.begin`.
     */
    throw new Error('Could not get config for region')
  }
}

export function createLocationString(countryCode: string, regionCode?: string) {
  return regionCode
    ? `${countryCode.toUpperCase()}-${regionCode.toUpperCase()}`
    : countryCode.toUpperCase()
}
