import type { DidString, HandleString } from '@atproto/syntax'

export type { DidString }

export type Account = {
  did: DidString
  pds: DidString
  deactivated: boolean
  locale?: string
  email?: string
  emailVerified?: boolean
  name?: string
  handle?: HandleString
  picture?: string
}

/**
 * Represents an account that is currently signed-in to the Authorization
 * Server. If the session was created too long ago, the user may be required to
 * re-authenticate ({@link Session.loginRequired}).
 */
export type Session = {
  account: Account
  info?: never // Prevent relying on this in the frontend

  loginRequired: boolean
}

export type MultiLangString = Record<string, string | undefined>

export type LinkDefinition = {
  title: string | MultiLangString
  href: string
  rel?: string
}

export type DeviceMetadata = {
  userAgent: string | null
  ipAddress: string
  lastSeenAt: ISODateString
}

export type ISODateString = `${string}T${string}Z`
