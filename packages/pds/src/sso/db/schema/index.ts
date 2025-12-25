import * as identityProvider from "./identity-provider"
import * as authCallback from "./auth-callback"
import * as authClaims from "./auth-claims"

export type DatabaseSchema =
  & identityProvider.PartialDB
  & authCallback.PartialDB
  & authClaims.PartialDB

export type {
  IdentityProvider,
  IdentityProviderEntry,
} from "./identity-provider"
export type { AuthCallback, AuthCallbackEntry } from "./auth-callback"
export type { AuthClaims, AuthClaimsEntry } from "./auth-claims"
