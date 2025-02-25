import { Simplify } from '../lib/util/type.js'
import { Sub } from '../oidc/sub.js'

export type Account = Simplify<{
  sub: Sub // Account id
  aud: string | [string, ...string[]] // Resource server URL

  // OIDC inspired
  preferred_username?: string
  email?: string
  email_verified?: boolean
  picture?: string
  name?: string
}>
