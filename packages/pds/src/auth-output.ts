import { ScopePermissions } from '@atproto/oauth-scopes'
import { DidString } from '@atproto/syntax'
import { AuthScope } from './auth-scope'

export type UnauthenticatedOutput = {
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
    did: DidString
  }
}

export type AccessOutput<S extends AuthScope = AuthScope> = {
  credentials: {
    type: 'access'
    did: DidString
    scope: S
  }
}

export type OAuthOutput = {
  credentials: {
    type: 'oauth'
    did: DidString
    permissions: ScopePermissions
  }
}

export type RefreshOutput = {
  credentials: {
    type: 'refresh'
    did: DidString
    scope: AuthScope.Refresh
    tokenId: string
  }
}

export type UserServiceAuthOutput = {
  credentials: {
    type: 'user_service_auth'
    did: DidString
  }
}
