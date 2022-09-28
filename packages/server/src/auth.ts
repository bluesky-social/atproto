import * as auth from '@adxp/auth'
import { DidResolver } from '@adxp/did-sdk'
import express from 'express'
import * as jwt from 'jsonwebtoken'

const BEARER = 'Bearer '

export type ServerAuthOpts = {
  jwtSecret: string
  didResolver: DidResolver
}
export class ServerAuth {
  private _secret
  didResolver: DidResolver
  verifier: auth.Verifier

  constructor(opts: ServerAuthOpts) {
    this._secret = opts.jwtSecret
    this.didResolver = opts.didResolver
    this.verifier = new auth.Verifier({ didResolver: opts.didResolver })
  }

  createToken(did: string): string {
    return jwt.sign(
      {
        sub: did,
      },
      this._secret,
    )
  }

  getUserDid(req: express.Request): string | null {
    const header = req.headers.authorization || ''
    if (!header.startsWith(BEARER)) return null
    const token = header.slice(BEARER.length)
    const payload = jwt.verify(token, this._secret)
    const sub = payload.sub
    if (typeof sub !== 'string') return null
    if (!sub.startsWith('did:')) return null
    return sub
  }

  verifyUser(req: express.Request, did: string): boolean {
    const authorized = this.getUserDid(req)
    return authorized === did
  }

  toString(): string {
    return 'Server auth: JWT'
  }
}

export default ServerAuth
