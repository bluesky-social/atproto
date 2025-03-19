export type Account = {
  sub: string
  aud: string | [string, ...string[]]

  email?: string
  email_verified?: boolean
  name?: string
  preferred_username?: string
  picture?: string
}

export type Session = {
  account: Account
  info?: never // Prevent relying on this in the frontend

  selected: boolean
  loginRequired: boolean
  consentRequired: boolean
}

export type LocalizedString =
  | string
  | ({ en: string } & Record<string, string | undefined>)

export type LinkDefinition = {
  title: LocalizedString
  href: string
  rel?: string
}

export type ScopeDetail = {
  scope: string
  description?: string
}
