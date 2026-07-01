import { describe, expect, it } from 'vitest'
import {
  parseKWSAgeVerifiedStatus,
  serializeKWSAgeVerifiedStatus,
} from './age-verified.js'

describe('parseKWSAgeVerifiedStatus', () => {
  it('parses a minimal status object', () => {
    const raw = JSON.stringify({ verified: true, verifiedMinimumAge: 18 })
    expect(parseKWSAgeVerifiedStatus(raw)).toEqual({
      verified: true,
      verifiedMinimumAge: 18,
    })
  })

  it('parses the optional transactionId and timestamp fields', () => {
    const raw = JSON.stringify({
      verified: true,
      verifiedMinimumAge: 18,
      transactionId: 'txn-123',
      timestamp: 1750680000,
    })
    expect(parseKWSAgeVerifiedStatus(raw)).toEqual({
      verified: true,
      verifiedMinimumAge: 18,
      transactionId: 'txn-123',
      timestamp: 1750680000,
    })
  })

  it('tolerates the new timestamp field without transactionId', () => {
    const raw = JSON.stringify({
      verified: true,
      verifiedMinimumAge: 18,
      timestamp: 1750680000,
    })
    expect(parseKWSAgeVerifiedStatus(raw)).toEqual({
      verified: true,
      verifiedMinimumAge: 18,
      timestamp: 1750680000,
    })
  })

  it('silently strips unknown fields KWS may add', () => {
    const raw = JSON.stringify({
      verified: true,
      verifiedMinimumAge: 18,
      timestamp: 1750680000,
      errorCode: null,
      somethingNew: 'ignored',
    })
    expect(parseKWSAgeVerifiedStatus(raw)).toEqual({
      verified: true,
      verifiedMinimumAge: 18,
      timestamp: 1750680000,
      errorCode: null,
    })
  })

  it('strips a truly unknown field', () => {
    const raw = JSON.stringify({
      verified: true,
      verifiedMinimumAge: 18,
      somethingNew: 'ignored',
    })
    expect(parseKWSAgeVerifiedStatus(raw)).toEqual({
      verified: true,
      verifiedMinimumAge: 18,
    })
  })

  it('throws on malformed JSON', () => {
    expect(() => parseKWSAgeVerifiedStatus('not json')).toThrow(
      /Invalid KWS age-verified status/,
    )
  })

  it('throws when a required field is missing', () => {
    const raw = JSON.stringify({ verified: true })
    expect(() => parseKWSAgeVerifiedStatus(raw)).toThrow(
      /Invalid KWS age-verified status/,
    )
  })
})

describe('serializeKWSAgeVerifiedStatus', () => {
  it('round-trips a status object including timestamp', () => {
    const status = {
      verified: true,
      verifiedMinimumAge: 18,
      transactionId: 'txn-123',
      timestamp: 1750680000,
    }
    expect(
      parseKWSAgeVerifiedStatus(serializeKWSAgeVerifiedStatus(status)),
    ).toEqual(status)
  })
})
