export class SpaceTokenError extends Error {
  constructor(
    message: string,
    public readonly code:
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
    this.name = 'SpaceTokenError'
  }
}

export class SpaceSignatureError extends Error {
  name = 'SpaceSignatureError'
  readonly code = 'BadSpaceSignature'
}

export class RepoVerificationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoVerificationError'
  }
}
