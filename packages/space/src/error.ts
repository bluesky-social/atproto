/** Every error this package throws on a protocol failure carries a stable `code`. */
export abstract class SpaceError extends Error {
  abstract readonly code: string
}

export class SpaceTokenError extends SpaceError {
  name = 'SpaceTokenError'

  constructor(
    message: string,
    readonly code:
      | 'BadJwt'
      | 'BadJwtType'
      | 'BadJwtIss'
      | 'BadJwtSub'
      | 'BadJwtAudience'
      | 'BadJwtCnf'
      | 'BadJwtSignature'
      | 'JwtExpired' = 'BadJwt',
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export class SpaceSignatureError extends SpaceError {
  name = 'SpaceSignatureError'
  readonly code = 'BadSpaceSignature'
}

export class SpaceMacError extends SpaceError {
  name = 'SpaceMacError'
  readonly code = 'InvalidSpaceMac'
}

export class SpaceKemError extends SpaceError {
  name = 'SpaceKemError'
  readonly code = 'InvalidKemKey'
}

export class SpaceRepoVerificationError extends SpaceError {
  name = 'SpaceRepoVerificationError'
  readonly code = 'InvalidSpaceRepo'
}

export class StarParseError extends SpaceError {
  name = 'StarParseError'
  readonly code = 'InvalidStar'
}

export class SpaceMetaArchiveError extends SpaceError {
  name = 'SpaceMetaArchiveError'
  readonly code = 'InvalidSpaceMeta'
}
