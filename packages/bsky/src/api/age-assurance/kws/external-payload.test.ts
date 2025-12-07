import { describe, expect, it } from '@jest/globals'
import {
  KWSExternalPayloadVersion,
  parseKWSExternalPayloadV1WithV2Compat,
  parseKWSExternalPayloadV2,
  parseKWSExternalPayloadVersion,
  serializeKWSExternalPayloadV1,
  serializeKWSExternalPayloadV2,
} from './external-payload'

describe('parseKWSExternalPayloadVersion', () => {
  it('should return V2 for "2"', () => {
    const result = parseKWSExternalPayloadVersion('2')
    expect(result).toBe('2')
  })
  it('should return V1 for unknown versions', () => {
    const result = parseKWSExternalPayloadVersion('unknown')
    expect(result).toBe('1')
  })
})

describe('parseKWSExternalPayloadV1WithV2Compat', () => {
  it('should parse V1 payload correctly', () => {
    const payload = {
      attemptId: '123',
      actorDid: 'did:plc:123',
    }
    const serialized = serializeKWSExternalPayloadV1(payload)
    const result = parseKWSExternalPayloadV1WithV2Compat(serialized)
    expect(result).toEqual({
      version: KWSExternalPayloadVersion.V1,
      ...payload,
    })
  })
  it('should parse V2 payload correctly', () => {
    const payload = {
      version: KWSExternalPayloadVersion.V2 as const,
      attemptId: '123',
      actorDid: 'did:plc:123',
      countryCode: 'US',
    }
    const serialized = serializeKWSExternalPayloadV2(payload)
    const result = parseKWSExternalPayloadV1WithV2Compat(serialized)
    expect(result).toEqual(payload)
  })
})

describe('serializeKWSExternalPayloadV2 & parseKWSExternalPayloadV2', () => {
  const payload = {
    version: KWSExternalPayloadVersion.V2 as const,
    attemptId: '123',
    actorDid: 'did:plc:123',
    countryCode: 'US',
    regionCode: 'CA',
  }
  it('compresses when serializing', () => {
    const serialized = serializeKWSExternalPayloadV2(payload)
    const comparison = JSON.stringify({
      v: KWSExternalPayloadVersion.V2,
      id: payload.attemptId,
      did: payload.actorDid,
      gc: payload.countryCode,
      gr: payload.regionCode,
    })
    expect(serialized).toEqual(comparison)
  })
  it('decompresses when parsing', () => {
    const serialized = serializeKWSExternalPayloadV2(payload)
    const deserialized = parseKWSExternalPayloadV2(serialized)
    expect(deserialized).toEqual(payload)
  })
})
