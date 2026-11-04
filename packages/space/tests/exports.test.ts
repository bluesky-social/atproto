import { describe, expect, it } from 'vitest'
import * as space from '../src/index.js'

describe('public API', () => {
  it.each([
    'defs',
    'formatSetHashElement',
    'LTHASH_STATE_BYTES',
    'SPACE_TOKEN_TYPES',
    'REPO_STAR_TYPE',
    'SPACE_META_STAR_TYPE',
  ])('does not export %s', (name) => {
    expect(name in space).toBe(false)
  })
})
