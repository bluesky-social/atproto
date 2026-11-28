import { describe, expect, it } from 'vitest'
import { isAllowedProfileLinkUrl } from './profile-link-rules.js'

describe('isAllowedProfileLinkUrl', () => {
  it('allows https links', () => {
    expect(isAllowedProfileLinkUrl('https://ko-fi.com/kat')).toBe(true)
  })

  it('rejects other schemes and invalid URLs', () => {
    expect(isAllowedProfileLinkUrl('http://example.com')).toBe(false)
    expect(isAllowedProfileLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedProfileLinkUrl('ftp://example.com')).toBe(false)
    expect(isAllowedProfileLinkUrl('example.com')).toBe(false)
  })

  it('rejects general-purpose shorteners and their subdomains', () => {
    expect(isAllowedProfileLinkUrl('https://bit.ly/abc')).toBe(false)
    expect(isAllowedProfileLinkUrl('https://www.tinyurl.com/abc')).toBe(false)
    expect(isAllowedProfileLinkUrl('https://shorten.world/abc')).toBe(false)
  })

  it('allows brand short links and lookalikes', () => {
    expect(isAllowedProfileLinkUrl('https://youtu.be/abc')).toBe(true)
    expect(isAllowedProfileLinkUrl('https://notbit.ly/abc')).toBe(true)
  })
})
