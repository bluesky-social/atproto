import { describe, expect, it } from 'vitest'
import { contentMime } from './util.ts'

describe(contentMime, () => {
  it('returns the MIME type', () => {
    expect(
      contentMime(new Headers({ 'content-type': 'application/json' })),
    ).toBe('application/json')
  })

  it('returns undefined for missing content-type', () => {
    expect(contentMime(new Headers())).toBeUndefined()
  })

  it('strips charset from content-type', () => {
    expect(
      contentMime(
        new Headers({ 'content-type': 'application/json; charset=utf-8' }),
      ),
    ).toBe('application/json')
  })
})
