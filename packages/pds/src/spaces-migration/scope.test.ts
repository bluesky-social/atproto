import { grantsSpaceAccess } from './scope.js'

describe('grantsSpaceAccess', () => {
  it('is granted by a space permission', () => {
    expect(grantsSpaceAccess('atproto space:com.example.space')).toBe(true)
    expect(grantsSpaceAccess('atproto space:*?authority=*')).toBe(true)
  })

  it('is not granted without a space permission', () => {
    expect(grantsSpaceAccess('atproto')).toBe(false)
    expect(grantsSpaceAccess('atproto transition:generic')).toBe(false)
    expect(grantsSpaceAccess('atproto repo:com.example.record')).toBe(false)
  })

  it('is not granted by a malformed space permission', () => {
    expect(grantsSpaceAccess('atproto space:not-an-nsid')).toBe(false)
    expect(grantsSpaceAccess('atproto space:com.example.space?action=x')).toBe(
      false,
    )
  })
})
