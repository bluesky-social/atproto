import {
  type AppBskyAgeassuranceDefs,
  computeAgeAssuranceRegionAccess,
  getAgeAssuranceRegionConfig,
} from '@atproto/api'

/**
 * Compute age assurance access based on verified minimum age. Thrown errors
 * are internal errors, so handle them accordingly.
 */
export function computeAgeAssuranceAccessOrThrow(
  config: AppBskyAgeassuranceDefs.Config,
  {
    countryCode,
    regionCode,
    verifiedMinimumAge,
  }: {
    countryCode: string
    regionCode?: string
    verifiedMinimumAge: number
  },
) {
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
