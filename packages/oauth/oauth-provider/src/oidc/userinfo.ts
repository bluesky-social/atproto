import { OIDCStandardPayload } from './claims.js'

export type Userinfo = OIDCStandardPayload & {
  // "The sub (subject) Claim MUST always be returned in the UserInfo Response."
  sub: string

  // client_id is not mandatory per spec, but we require it here for convenience
  client_id: string

  username?: string
}
