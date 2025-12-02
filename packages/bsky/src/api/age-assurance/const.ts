import {
  AppBskyAgeassuranceDefs,
  ageAssuranceRuleIDs as ids,
} from '@atproto/api'

/**
 * Age assurance configuration defining rules for various regions.
 *
 * NOTE: These rules are matched in order, and the first matching rule
 * determines the access level granted.
 *
 * NOTE: all regions MUST have a default rule as the last rule.
 */
export const AGE_ASSURANCE_CONFIG: AppBskyAgeassuranceDefs.Config = {
  regions: [
    {
      countryCode: 'GB',
      regionCode: undefined,
      rules: [
        {
          $type: ids.IfAssuredOverAge,
          age: 18,
          access: 'full',
        },
        {
          $type: ids.IfDeclaredOverAge,
          age: 13,
          access: 'safe',
        },
        {
          $type: ids.Default,
          access: 'none',
        },
      ],
    },
    {
      countryCode: 'AU',
      regionCode: undefined,
      rules: [
        {
          $type: ids.IfAccountNewerThan,
          date: '2025-12-10T00:00:00Z',
          access: 'none',
        },
        {
          $type: ids.IfAssuredOverAge,
          age: 18,
          access: 'full',
        },
        {
          $type: ids.IfAssuredOverAge,
          age: 16,
          access: 'safe',
        },
        {
          $type: ids.IfDeclaredOverAge,
          age: 16,
          access: 'safe',
        },
        {
          $type: ids.Default,
          access: 'none',
        },
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'SD',
      rules: [
        {
          $type: ids.IfAssuredOverAge,
          age: 18,
          access: 'full',
        },
        {
          $type: ids.IfDeclaredOverAge,
          age: 13,
          access: 'safe',
        },
        {
          $type: ids.Default,
          access: 'none',
        },
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'WY',
      rules: [
        {
          $type: ids.IfAssuredOverAge,
          age: 18,
          access: 'full',
        },
        {
          $type: ids.IfDeclaredOverAge,
          age: 13,
          access: 'safe',
        },
        {
          $type: ids.Default,
          access: 'none',
        },
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'OH',
      rules: [
        {
          $type: ids.IfAssuredOverAge,
          age: 18,
          access: 'full',
        },
        {
          $type: ids.IfDeclaredOverAge,
          age: 13,
          access: 'safe',
        },
        {
          $type: ids.Default,
          access: 'none',
        },
      ],
    },
    {
      countryCode: 'US',
      regionCode: 'MS',
      rules: [
        {
          $type: ids.IfAssuredOverAge,
          age: 18,
          access: 'full',
        },
        {
          $type: ids.Default,
          access: 'none',
        },
      ],
    },
  ],
}
