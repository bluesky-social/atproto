import { SignedTokenPayload } from '@atproto/oauth-provider'
import { AuthScope } from './auth-scope'
import { PermissionSet } from './permissions'

export type NullOutput = {
  credentials: null
}

export type AdminTokenOutput = {
  credentials: {
    type: 'admin_token'
  }
}

export type ModServiceOutput = {
  credentials: {
    type: 'mod_service'
    did: string
  }
}

export type AccessOutput<S extends AuthScope = AuthScope> = {
  credentials: {
    type: 'access'
    did: string
    scope: S
  }
}

export type AuthorizationOutput = {
  credentials: {
    type: 'permissions'
    did: string
    permissions: PermissionSet
  }
}

export type OAuthOutput = {
  credentials: {
    type: 'oauth'
    did: string
    tokenClaims: SignedTokenPayload
  }
}

export type RefreshOutput = {
  credentials: {
    type: 'refresh'
    did: string
    scope: AuthScope.Refresh
    tokenId: string
  }
}

export type UserServiceAuthOutput = {
  credentials: {
    type: 'user_service_auth'
    did: string
  }
}
