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

export class DpopProofError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'BadDpopProof'
      | 'BadDpopProofSignature'
      | 'DpopProofExpired'
      | 'DpopKeyMismatch' = 'BadDpopProof',
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'DpopProofError'
  }
}

export class RepoVerificationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoVerificationError'
  }
}
