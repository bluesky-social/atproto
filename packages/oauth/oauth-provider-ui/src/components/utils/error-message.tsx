import { Trans } from '@lingui/react/macro'
import { ReactNode, memo } from 'react'
import {
  AccessDeniedError,
  EmailTakenError,
  HandleUnavailableError,
  InvalidCredentialsError,
  InvalidInviteCodeError,
  InvalidRequestError,
  RequestExpiredError,
  SecondAuthenticationFactorRequiredError,
  UnknownRequestUriError,
} from '../../lib/api.ts'
import { JsonErrorResponse } from '../../lib/json-client.ts'

export type ApiErrorMessageProps = {
  error: unknown
}

export const ErrorMessage = memo(function ErrorMessage({
  error,
}: ApiErrorMessageProps): ReactNode {
  // Matches the order of the error checks in the API's parseError method (must
  // be from most specific to least specific to avoid unreachable code paths).

  if (error instanceof SecondAuthenticationFactorRequiredError) {
    return <Trans>A second authentication factor is required</Trans>
  }

  if (error instanceof InvalidCredentialsError) {
    return <Trans>Wrong identifier or password</Trans>
  }

  if (error instanceof InvalidInviteCodeError) {
    return <Trans>The invite code is not valid</Trans>
  }

  if (error instanceof HandleUnavailableError) {
    switch (error.reason) {
      case 'syntax':
        return <Trans>The handle is invalid</Trans>
      case 'domain':
        return <Trans>The domain name is not allowed</Trans>
      case 'slur':
        return <Trans>The handle contains inappropriate language</Trans>
      case 'taken':
        if (error.description === 'Reserved handle') {
          return <Trans>This handle is reserved</Trans>
        }
        return <Trans>The handle is already in use</Trans>
      default:
        return <Trans>That handle cannot be used</Trans>
    }
  }

  if (error instanceof EmailTakenError) {
    return <Trans>This email is already used</Trans>
  }

  if (
    error instanceof UnknownRequestUriError ||
    error instanceof RequestExpiredError
  ) {
    return <Trans>This sign-in session has expired</Trans>
  }

  if (error instanceof InvalidRequestError) {
    return (
      <Trans>
        The data you submitted is invalid. Please check the form and try again.
      </Trans>
    )
  }

  if (error instanceof AccessDeniedError) {
    return (
      <Trans>
        This authorization request has been denied. Please try again.
      </Trans>
    )
  }

  if (error instanceof JsonErrorResponse) {
    return <Trans>Unexpected server response</Trans>
  }

  return <Trans>An unknown error occurred</Trans>
})
