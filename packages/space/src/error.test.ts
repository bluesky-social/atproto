import { describe, expect, it } from 'vitest'
import {
  SpaceError,
  SpaceKemError,
  SpaceMacError,
  SpaceMetaArchiveError,
  SpaceRepoVerificationError,
  SpaceSignatureError,
  SpaceTokenError,
} from './error.js'

describe('SpaceError', () => {
  it.each([
    [new SpaceTokenError('x', 'JwtExpired'), 'SpaceTokenError', 'JwtExpired'],
    [new SpaceSignatureError('x'), 'SpaceSignatureError', 'BadSpaceSignature'],
    [new SpaceMacError('x'), 'SpaceMacError', 'InvalidSpaceMac'],
    [new SpaceKemError('x'), 'SpaceKemError', 'InvalidKemKey'],
    [
      new SpaceRepoVerificationError('x'),
      'SpaceRepoVerificationError',
      'InvalidSpaceRepo',
    ],
    [
      new SpaceMetaArchiveError('x'),
      'SpaceMetaArchiveError',
      'InvalidSpaceMeta',
    ],
  ])('%s has a name and a code', (err, name, code) => {
    expect(err).toBeInstanceOf(SpaceError)
    expect(err.name).toBe(name)
    expect(err.code).toBe(code)
  })

  it('defaults a token error code to BadJwt', () => {
    expect(new SpaceTokenError('x').code).toBe('BadJwt')
  })
})
