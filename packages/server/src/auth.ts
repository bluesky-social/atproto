import * as auth from '@atproto/auth'
import { AuthRequiredError } from '@atproto/xrpc-server'
import * as uint8arrays from 'uint8arrays'
import { DidResolver } from '@atproto/did-resolver'
import express from 'express'
import * as jwt from 'jsonwebtoken'

const BEARER = 'Bearer '
const BASIC = 'Basic '

export type ServerAuthOpts = {
  jwtSecret: string
  didResolver: DidResolver
  adminPass: string
}
export class ServerAuth {
  private _secret: string
  private _adminPass: string
  didResolver: DidResolver
  verifier: auth.Verifier

  constructor(opts: ServerAuthOpts) {
    this._secret = opts.jwtSecret
    this._adminPass = opts.adminPass
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

  getUserDidOrThrow(req: express.Request): string {
    const did = this.getUserDid(req)
    if (did === null) {
      throw new AuthRequiredError()
    }
    return did
  }

  verifyUser(req: express.Request, did: string): boolean {
    const authorized = this.getUserDid(req)
    return authorized === did
  }

  verifyAdmin(req: express.Request): boolean {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    if (!parsed) return false
    const { username, password } = parsed
    if (username !== 'admin') return false
    if (password !== this._adminPass) return false
    return true
  }

  toString(): string {
    return 'Server auth: JWT'
  }
}

export const parseBasicAuth = (
  token: string,
): { username: string; password: string } | null => {
  if (!token.startsWith(BASIC)) return null
  const b64 = token.slice(BASIC.length)
  let parsed: string[]
  try {
    parsed = uint8arrays
      .toString(uint8arrays.fromString(b64, 'base64pad'), 'utf8')
      .split(':')
  } catch (err) {
    return null
  }
  const [username, password] = parsed
  if (!username || !password) return null
  return { username, password }
}

export default ServerAuth
