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
    aud: string
    iss: string
  }
}

export type AccessOutput<S extends AuthScope = AuthScope> = {
  credentials: {
    type: 'access'
    did: string
    scope: S
    isPrivileged: boolean
  }
}

export type AuthorizationOutput<R = unknown> = {
  credentials: {
    type: 'authorization'
    did: string
    permissions: PermissionSet
    authorization: R
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
    aud: string
    did: string
  }
}
