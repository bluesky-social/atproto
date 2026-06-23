import { ScopePermissions } from '@atproto/oauth-scopes'
import { DidString } from '@atproto/syntax'
import { AuthScope } from './auth-scope.js'

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

export type ServiceAuthOutput = {
  credentials: {
    type: 'service_auth'
    iss: DidString
    aud: string
    lxm: string
  }
}

export type SpaceCredentialOutput = {
  credentials: {
    type: 'space_credential'
    iss: string
    // The space URI the credential reads (the credential's `sub`).
    space: string
    clientId?: string
  }
}

export type DelegationTokenOutput = {
  credentials: {
    type: 'delegation_token'
    // The user the token acts for (the token's `iss`).
    userDid: string
    // The space host the token is addressed to (the token's `aud`).
    aud: string
    // The space URI being requested (the token's `sub`).
    space: string
  }
}
