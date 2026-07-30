export class SpaceTokenError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'BadJwt'
      | 'BadJwtType'
      | 'BadJwtIss'
      | 'BadJwtSub'
      | 'BadJwtAudience'
      | 'BadJwtSignature'
      | 'JwtExpired' = 'BadJwt',
  ) {
    super(message)
    this.name = 'SpaceTokenError'
  }
}

export class RepoVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RepoVerificationError'
  }
}
