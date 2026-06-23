import { describe, expect, it } from 'vitest'
import { parseStatus } from './util.js'

describe('parseStatus', () => {
  it('parses a minimal status object', () => {
    const raw = JSON.stringify({ verified: true })
    expect(parseStatus(raw)).toEqual({ verified: true })
  })

  it('parses the optional transactionId, errorCode, and timestamp fields', () => {
    const raw = JSON.stringify({
      verified: true,
      transactionId: 'txn-123',
      errorCode: null,
      timestamp: 1750680000,
    })
    expect(parseStatus(raw)).toEqual({
      verified: true,
      transactionId: 'txn-123',
      errorCode: null,
      timestamp: 1750680000,
    })
  })

  it('parses a non-null errorCode', () => {
    const raw = JSON.stringify({ verified: false, errorCode: 'some-failure' })
    expect(parseStatus(raw)).toEqual({
      verified: false,
      errorCode: 'some-failure',
    })
  })

  it('silently strips unknown fields KWS may add', () => {
    const raw = JSON.stringify({
      verified: true,
      timestamp: 1750680000,
      somethingNew: 'ignored',
    })
    expect(parseStatus(raw)).toEqual({ verified: true, timestamp: 1750680000 })
  })

  it('throws on malformed JSON', () => {
    expect(() => parseStatus('not json')).toThrow(/Invalid status/)
  })

  it('throws when verified is missing', () => {
    const raw = JSON.stringify({ timestamp: 1750680000 })
    expect(() => parseStatus(raw)).toThrow(/Invalid status/)
  })
})
