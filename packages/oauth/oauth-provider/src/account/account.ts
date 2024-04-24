import { OIDCStandardPayload } from '../oidc/claims.js'
import { Sub } from '../oidc/sub.js'
import { Simplify } from '../lib/util/type.js'

export type Account = Simplify<
  {
    sub: Sub // Account id
    aud: string | [string, ...string[]] // Resource server URL
  } & OIDCStandardPayload
>
