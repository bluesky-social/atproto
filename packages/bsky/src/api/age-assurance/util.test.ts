import { describe, expect, it } from 'vitest'
import { app } from '../../lexicons/index.js'
import {
  computeAgeAssuranceRegionAccess,
  getAgeAssuranceRegionConfig,
} from './util.js'

const defs = app.bsky.ageassurance.defs

describe('age-assurance', () => {
  describe('getAgeAssuranceRegionConfig', () => {
    const config: app.bsky.ageassurance.defs.Config = {
      regions: [
        {
          countryCode: 'US',
          regionCode: 'CA',
          minAccessAge: 13,
          rules: [],
        },
        {
          platforms: ['ios', 'android'],
          countryCode: 'US',
          regionCode: 'TX',
          minAccessAge: 18,
          rules: [],
        },
        {
          countryCode: 'US',
          minAccessAge: 13,
          rules: [],
        },
      ],
    }

    it('should find region by country code only', () => {
      const result = getAgeAssuranceRegionConfig(config, {
        countryCode: 'US',
      })

      expect(result).toEqual({
        countryCode: 'US',
        minAccessAge: 13,
        rules: [],
      })
    })

    it('should find region by country code and region code', () => {
      const result = getAgeAssuranceRegionConfig(config, {
        countryCode: 'US',
        regionCode: 'CA',
      })

      expect(result).toEqual({
        countryCode: 'US',
        regionCode: 'CA',
        minAccessAge: 13,
        rules: [],
      })
    })

    it('should return undefined when no matching region found', () => {
      const result = getAgeAssuranceRegionConfig(config, {
        countryCode: 'GB',
      })

      expect(result).toBeUndefined()
    })

    it('should find platform-restricted region when platform matches', () => {
      const result = getAgeAssuranceRegionConfig(config, {
        countryCode: 'US',
        regionCode: 'TX',
        platform: 'ios',
      })

      expect(result).toEqual({
        platforms: ['ios', 'android'],
        countryCode: 'US',
        regionCode: 'TX',
        minAccessAge: 18,
        rules: [],
      })
    })

    it('should skip platform-restricted region when platform does not match', () => {
      const result = getAgeAssuranceRegionConfig(config, {
        countryCode: 'US',
        regionCode: 'TX',
        platform: 'web',
      })

      // falls through to the country-wide US config
      expect(result).toEqual({
        countryCode: 'US',
        minAccessAge: 13,
        rules: [],
      })
    })

    it('should ignore platform restrictions when platform is not provided', () => {
      const result = getAgeAssuranceRegionConfig(config, {
        countryCode: 'US',
        regionCode: 'TX',
      })

      expect(result).toEqual({
        platforms: ['ios', 'android'],
        countryCode: 'US',
        regionCode: 'TX',
        minAccessAge: 18,
        rules: [],
      })
    })
  })

  describe('computeAgeAssuranceRegionAccess', () => {
    const region: app.bsky.ageassurance.defs.ConfigRegion = {
      countryCode: 'US',
      minAccessAge: 13,
      rules: [
        defs.configRegionRuleIfAccountNewerThan.$build({
          date: '2025-12-10T00:00:00Z',
          access: 'none',
        }),
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 18,
          access: 'full',
        }),
        defs.configRegionRuleIfAssuredOverAge.$build({
          age: 16,
          access: 'safe',
        }),
        defs.configRegionRuleIfDeclaredOverAge.$build({
          age: 16,
          access: 'safe',
        }),
        defs.configRegionRuleDefault.$build({
          access: 'none',
        }),
      ],
    }

    it('should apply default if no data provided', () => {
      const result = computeAgeAssuranceRegionAccess(region, {})

      expect(result).toEqual({
        access: 'none',
        reason: defs.configRegionRuleDefault.$type,
      })
    })

    describe('IfAccountNewerThan', () => {
      it('should block accounts created after threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          accountCreatedAt: new Date(2025, 11, 15).toISOString(),
          declaredAge: 18,
        })
        expect(result).toEqual({
          access: 'none',
          reason: defs.configRegionRuleIfAccountNewerThan.$type,
        })
      })

      it('should allow accounts created before threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          accountCreatedAt: new Date(2025, 10, 1).toISOString(),
          declaredAge: 18,
        })
        expect(result).toEqual({
          access: 'safe',
          reason: defs.configRegionRuleIfDeclaredOverAge.$type,
        })
      })

      it('should allow accounts created exactly at threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          accountCreatedAt: new Date(2025, 11, 1).toISOString(),
          declaredAge: 18,
        })
        expect(result).toEqual({
          access: 'safe',
          reason: defs.configRegionRuleIfDeclaredOverAge.$type,
        })
      })

      it('should not apply rule when accountCreatedAt is not provided', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          declaredAge: 15,
        })
        expect(result).toEqual({
          access: 'none',
          reason: defs.configRegionRuleDefault.$type,
        })
      })

      it('should not apply rule when assuredAge is present', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          accountCreatedAt: new Date(2025, 11, 15).toISOString(),
          assuredAge: 20,
        })
        expect(result).toEqual({
          access: 'full',
          reason: defs.configRegionRuleIfAssuredOverAge.$type,
        })
      })
    })

    describe('IfDeclaredOverAge rule', () => {
      it('should allow users at or above age threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          declaredAge: 18,
        })

        expect(result).toEqual({
          access: 'safe',
          reason: defs.configRegionRuleIfDeclaredOverAge.$type,
        })
      })

      it('should allow users above age threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          declaredAge: 25,
        })

        expect(result).toEqual({
          access: 'safe',
          reason: defs.configRegionRuleIfDeclaredOverAge.$type,
        })
      })

      it('should not allow users below age threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          declaredAge: 17,
        })

        expect(result).toEqual({
          access: 'safe',
          reason: defs.configRegionRuleIfDeclaredOverAge.$type,
        })
      })
    })

    describe('IfAssuredOverAge rule', () => {
      it('should allow users at or above assured age threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          assuredAge: 18,
        })

        expect(result).toEqual({
          access: 'full',
          reason: defs.configRegionRuleIfAssuredOverAge.$type,
        })
      })

      it('should not allow users below assured age threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          assuredAge: 17,
        })

        expect(result).toEqual({
          access: 'safe',
          reason: defs.configRegionRuleIfAssuredOverAge.$type,
        })
      })
    })
  })
})
