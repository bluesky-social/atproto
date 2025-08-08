import { isAccept, isMime, matchesAccept, matchesAnyAccept } from './mime.js'

describe('isAccept', () => {
  it('should return true for valid MIME types', () => {
    expect(isAccept('image/png')).toBe(true)
    expect(isAccept('application/json')).toBe(true)
    expect(isAccept('text/html')).toBe(true)
    expect(isAccept('image/*')).toBe(true)
    expect(isAccept('*/*')).toBe(true)
  })

  it('should return false for invalid MIME types', () => {
    expect(isAccept('image//png')).toBe(false)
    expect(isAccept('/png')).toBe(false)
    expect(isAccept('image/')).toBe(false)
    expect(isAccept('image/**')).toBe(false)
    expect(isAccept('*/png')).toBe(false)
    expect(isAccept('*')).toBe(false)
    expect(isAccept('image/png/extra')).toBe(false)
  })
})

describe('isMime', () => {
  it('should return true for valid MIME types', () => {
    expect(isMime('image/png')).toBe(true)
    expect(isMime('application/json')).toBe(true)
  })

  it('should return false for invalid MIME types', () => {
    expect(isMime('image/*')).toBe(false)
    expect(isMime('*/*')).toBe(false)
    expect(isMime('image/png/extra')).toBe(false)
    expect(isMime('*/mime')).toBe(false)
    expect(isMime('/png')).toBe(false)
    expect(isMime('image/')).toBe(false)
    expect(isMime('image')).toBe(false)
    expect(isMime('image/ png')).toBe(false)
    expect(isMime('image//png')).toBe(false)
  })
})

describe('matchesAccept', () => {
  it('should match exact MIME type', () => {
    expect(matchesAccept('image/png', 'image/png')).toBe(true)
  })

  it('should match wildcard MIME type', () => {
    expect(matchesAccept('image/*', 'image/jpeg')).toBe(true)
  })

  it('should match subtype wildcard MIME type', () => {
    expect(matchesAccept('image/*', 'image/gif')).toBe(true)
  })

  it('should not match different MIME type', () => {
    expect(matchesAccept('image/png', 'image/jpeg')).toBe(false)
  })

  it('should not match different wildcard MIME type', () => {
    expect(matchesAccept('image/*', 'text/html')).toBe(false)
  })

  it('should match any MIME type with *', () => {
    expect(matchesAccept('*/*', 'application/json')).toBe(true)
  })

  it('should not match invalid MIME type', () => {
    expect(matchesAccept('image/png', '*/mime')).toBe(false)
    expect(matchesAccept('image/png', 'image')).toBe(false)
    expect(matchesAccept('image/*', 'image//png')).toBe(false)
    expect(matchesAccept('image/*', 'image/ png')).toBe(false)
    expect(matchesAccept('*/*', 'image/')).toBe(false)
    expect(matchesAccept('*/*', '/mime')).toBe(false)
  })
})

describe('matchesAnyAccept', () => {
  it('should return true if any accept matches', () => {
    const accepts = ['image/png', 'application/json'] as const
    expect(matchesAnyAccept(accepts, 'image/png')).toBe(true)
    expect(matchesAnyAccept(accepts, 'application/json')).toBe(true)
  })

  it('should return false if no accept matches', () => {
    const accepts = ['image/png', 'application/json'] as const
    expect(matchesAnyAccept(accepts, 'text/html')).toBe(false)
  })

  it('should handle empty accepts array', () => {
    expect(matchesAnyAccept([], 'image/png')).toBe(false)
  })

  it('should handle single accept', () => {
    const accepts = ['image/*'] as const
    expect(matchesAnyAccept(accepts, 'image/jpeg')).toBe(true)
    expect(matchesAnyAccept(accepts, 'text/html')).toBe(false)
  })
})
