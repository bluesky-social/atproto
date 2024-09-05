import { Sub } from '../oidc/sub.js'
import { Simplify } from '../lib/util/type.js'

export type Account = Simplify<{
  sub: Sub // Account id
  aud: string | [string, ...string[]] // Resource server URL

  // OIDC inspired
  preferred_username?: string
  email?: string
  ethAddress?: string
  email_verified?: boolean
  picture?: string
  name?: string
}>
