/**
 * Used by the PersistSessionHandler to indicate what change occurred
 */
export type AtpSessionEvent = 'create' | 'create-failed' | 'update' | 'expired'

/**
 * Used by AtpAgent to store active sessions
 */
export interface AtpSessionData {
  refreshJwt: string
  accessJwt: string
  handle: string
  did: string
  email?: string
}

/**
 * Handler signature passed to AtpAgent to store session data
 */
export type AtpPersistSessionHandler = (
  evt: AtpSessionEvent,
  session: AtpSessionData | undefined,
) => void | Promise<void>

/**
 * AtpAgent constructor() opts
 */
export interface AtpAgentOpts {
  service: string | URL
  persistSession?: AtpPersistSessionHandler
}

/**
 * AtpAgent createAccount() opts
 */
export interface AtpAgentCreateAccountOpts {
  email: string
  password: string
  handle: string
  inviteCode?: string
}

/**
 * AtpAgent login() opts
 */
export interface AtpAgentLoginOpts {
  identifier: string
  password: string
}

/**
 * AtpAgent global fetch handler
 */
type AtpAgentFetchHeaders = Record<string, string>
export interface AtpAgentFetchHandlerResponse {
  status: number
  headers: Record<string, string>
  body: any
}
export type AtpAgentFetchHandler = (
  httpUri: string,
  httpMethod: string,
  httpHeaders: AtpAgentFetchHeaders,
  httpReqBody: any,
) => Promise<AtpAgentFetchHandlerResponse>

/**
 * AtpAgent global config opts
 */
export interface AtpAgentGlobalOpts {
  fetch: AtpAgentFetchHandler
}
