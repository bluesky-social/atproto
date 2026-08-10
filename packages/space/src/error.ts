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
  ) {
    super(message)
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
  ) {
    super(message)
    this.name = 'DpopProofError'
  }
}

export class RepoVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RepoVerificationError'
  }
}
