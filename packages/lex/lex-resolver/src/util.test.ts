import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('canParseUrl', () => {
  it('supports environments without URL.canParse', async () => {
    const LegacyURL = class extends URL {}
    Object.defineProperty(LegacyURL, 'canParse', { value: undefined })
    vi.stubGlobal('URL', LegacyURL)
    vi.resetModules()

    const { canParseUrl } = await import('./util.js')

    expect(canParseUrl('https://pds.example.com')).toBe(true)
    expect(canParseUrl('not-a-url')).toBe(false)
  })
})
