import { describe, expect, it } from '@jest/globals'
import {
  ageAssuranceRuleIDs,
  computeAgeAssuranceRegionAccess,
  getAgeAssuranceRegionConfig,
} from './age-assurance'
import { AppBskyAgeassuranceDefs } from './client'

describe('age-assurance', () => {
  describe('getAgeAssuranceRegionConfig', () => {
    const config: AppBskyAgeassuranceDefs.Config = {
      regions: [
        {
          countryCode: 'US',
          regionCode: 'CA',
          minAccessAge: 13,
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
  })

  describe('computeAgeAssuranceRegionAccess', () => {
    const region: AppBskyAgeassuranceDefs.ConfigRegion = {
      countryCode: 'US',
      minAccessAge: 13,
      rules: [
        {
          $type: ageAssuranceRuleIDs.IfAccountNewerThan,
          date: '2025-12-10T00:00:00Z',
          access: 'none',
        },
        {
          $type: ageAssuranceRuleIDs.IfAssuredOverAge,
          age: 18,
          access: 'full',
        },
        {
          $type: ageAssuranceRuleIDs.IfAssuredOverAge,
          age: 16,
          access: 'safe',
        },
        {
          $type: ageAssuranceRuleIDs.IfDeclaredOverAge,
          age: 16,
          access: 'safe',
        },
        {
          $type: ageAssuranceRuleIDs.Default,
          access: 'none',
        },
      ],
    }

    it('should apply default if no data provided', () => {
      const result = computeAgeAssuranceRegionAccess(region, {})

      expect(result).toEqual({
        access: 'none',
        reason: ageAssuranceRuleIDs.Default,
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
          reason: ageAssuranceRuleIDs.IfAccountNewerThan,
        })
      })

      it('should allow accounts created before threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          accountCreatedAt: new Date(2025, 10, 1).toISOString(),
          declaredAge: 18,
        })
        expect(result).toEqual({
          access: 'safe',
          reason: ageAssuranceRuleIDs.IfDeclaredOverAge,
        })
      })

      it('should allow accounts created exactly at threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          accountCreatedAt: new Date(2025, 11, 1).toISOString(),
          declaredAge: 18,
        })
        expect(result).toEqual({
          access: 'safe',
          reason: ageAssuranceRuleIDs.IfDeclaredOverAge,
        })
      })

      it('should not apply rule when accountCreatedAt is not provided', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          declaredAge: 15,
        })
        expect(result).toEqual({
          access: 'none',
          reason: ageAssuranceRuleIDs.Default,
        })
      })

      it('should not apply rule when assuredAge is present', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          accountCreatedAt: new Date(2025, 11, 15).toISOString(),
          assuredAge: 20,
        })
        expect(result).toEqual({
          access: 'full',
          reason: ageAssuranceRuleIDs.IfAssuredOverAge,
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
          reason: ageAssuranceRuleIDs.IfDeclaredOverAge,
        })
      })

      it('should allow users above age threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          declaredAge: 25,
        })

        expect(result).toEqual({
          access: 'safe',
          reason: ageAssuranceRuleIDs.IfDeclaredOverAge,
        })
      })

      it('should not allow users below age threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          declaredAge: 17,
        })

        expect(result).toEqual({
          access: 'safe',
          reason: ageAssuranceRuleIDs.IfDeclaredOverAge,
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
          reason: ageAssuranceRuleIDs.IfAssuredOverAge,
        })
      })

      it('should not allow users below assured age threshold', () => {
        const result = computeAgeAssuranceRegionAccess(region, {
          assuredAge: 17,
        })

        expect(result).toEqual({
          access: 'safe',
          reason: ageAssuranceRuleIDs.IfAssuredOverAge,
        })
      })
    })
  })
})
