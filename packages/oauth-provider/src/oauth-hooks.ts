/**
 * This file exposes all the hooks that can be used when instantiating the
 * OAuthProvider.
 */
import type { AccountHooks } from './account/account-hooks.js'
import type { ClientHooks } from './client/client-hooks.js'
import type { RequestHooks } from './request/request-hooks.js'
import type { TokenHooks } from './token/token-hooks.js'

export type * from './account/account-hooks.js'
export type * from './client/client-hooks.js'
export type * from './request/request-hooks.js'
export type * from './token/token-hooks.js'

export type OAuthHooks = AccountHooks & ClientHooks & RequestHooks & TokenHooks
