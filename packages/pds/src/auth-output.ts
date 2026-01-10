import { ScopePermissions } from '@atproto/oauth-scopes'
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

export type OAuthOutput = {
  credentials: {
    type: 'oauth'
    did: string
    permissions: ScopePermissions
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
