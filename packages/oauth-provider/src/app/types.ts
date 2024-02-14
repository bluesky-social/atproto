// ../client is not a shared module (frontend/backend) and cannot be imported in
// the frontend.
export type ClientMetadata = {
  client_id?: string
  application_type?: 'native' | 'web'
  contacts?: string[]
  client_name?: string
  logo_uri?: string
  client_uri?: string
  policy_uri?: string
  tos_uri?: string
  [key: string]: unknown
}

export type Address = {
  formatted?: string
  street_address?: string
  locality?: string
  region?: string
  postal_code?: string
  country?: string
}

export type Account = {
  sub: string
  aud: string

  email?: string
  email_verified?: boolean
  phone_number?: string
  phone_number_verified?: boolean
  address?: Address
  name?: string
  family_name?: string
  given_name?: string
  middle_name?: string
  nickname?: string
  preferred_username?: string
  gender?: string
  picture?: string
  profile?: string
  website?: string
  birthdate?: `${number}-${number}-${number}`
  zoneinfo?: string
  locale?: `${string}-${string}` | string
  updated_at?: number
}

export type Session = {
  account: Account
  loginRequired: boolean
  consentRequired: boolean
  initiallySelected: boolean
}
