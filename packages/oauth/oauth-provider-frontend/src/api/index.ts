import React from 'react'
import cookies from 'js-cookie'
import {
  Session as SessionBase,
  AuthorizeData as AuthorizeDataBase,
} from '@atproto/oauth-provider-api'

import { Api } from '#/api/client'
import { useAuthorizationData } from '#/data/useAuthorizationData'

export type {
  LocalizedString,
  CustomizationData,
  ErrorData,
} from '@atproto/oauth-provider-api'

/**
 * @deprecated use {@link Account} instead
 */
export type Session = SessionBase & {
  /**
   * @deprecated
   */
  did: string
}

export type Account = SessionBase

export type AuthorizeData = Omit<AuthorizeDataBase, 'sessions'> & {
  sessions: Session[]
}

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
