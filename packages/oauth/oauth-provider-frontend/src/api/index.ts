import React from 'react'
import cookies from 'js-cookie'

import { Api } from '#/api/client'
import { useAuthorizationData } from '#/data/useAuthorizationData'

export type {
  LocalizedString,
  CustomizationData,
  AuthorizeData,
  ErrorData,
} from '@atproto/oauth-provider-api'
export type { Account } from '#/api/temp-types'

export {
  SecondAuthenticationFactorRequiredError,
  InvalidCredentialsError,
  InvalidInviteCodeError,
  HandleUnavailableError,
  EmailTakenError,
  RequestExpiredError,
  UnknownRequestUriError,
  InvalidRequestError,
  AccessDeniedError,
} from '#/api/client'

export function useApi() {
  const { requestUri } = useAuthorizationData()
  const csrfToken = cookies.get(`csrf-${requestUri}`)

  if (!csrfToken) {
    throw new Error('CSRF token is missing.')
  }

  return React.useMemo(() => new Api(csrfToken), [csrfToken])
}
