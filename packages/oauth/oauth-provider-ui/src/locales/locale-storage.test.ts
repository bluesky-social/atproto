import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStoredLocale, writeStoredLocale } from './locale-storage.ts'

function stubStorage(storage: unknown) {
  vi.stubGlobal('localStorage', storage)
}

function fakeStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe(readStoredLocale, () => {
  it('returns undefined when nothing was stored', () => {
    stubStorage(fakeStorage())
    expect(readStoredLocale()).toBeUndefined()
  })

  it('returns a previously stored locale', () => {
    stubStorage(fakeStorage())
    writeStoredLocale('fr')
    expect(readStoredLocale()).toBe('fr')
  })

  it('ignores a stored value that is not an available locale', () => {
    stubStorage({ getItem: () => 'kl' })
    expect(readStoredLocale()).toBeUndefined()
  })

  it('returns undefined when storage access throws', () => {
    stubStorage({
      getItem: () => {
        throw new Error('Access denied')
      },
    })
    expect(readStoredLocale()).toBeUndefined()
  })

  it('returns undefined when there is no storage at all', () => {
    stubStorage(undefined)
    expect(readStoredLocale()).toBeUndefined()
  })
})

describe(writeStoredLocale, () => {
  it('does not throw when storage access is denied', () => {
    stubStorage({
      setItem: () => {
        throw new Error('Access denied')
      },
    })
    expect(() => writeStoredLocale('fr')).not.toThrow()
  })

  it('does not throw when there is no storage at all', () => {
    stubStorage(undefined)
    expect(() => writeStoredLocale('fr')).not.toThrow()
  })
})
