// @TODO replace with OidcUserinfo
export type Account = {
  sub: string
  aud: string | [string, ...string[]]

  locale?: string
  email?: string
  email_verified?: boolean
  name?: string
  preferred_username?: string
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
  consentRequired?: boolean
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
