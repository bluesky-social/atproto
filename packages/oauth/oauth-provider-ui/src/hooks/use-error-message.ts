import { useLingui } from '@lingui/react/macro'
import {
  AccessDeniedError,
  EmailTakenError,
  HandleUnavailableError,
  InvalidCredentialsError,
  InvalidInviteCodeError,
  InvalidRequestError,
  RequestExpiredError,
  SecondAuthenticationFactorRequiredError,
  UnauthorizedError,
  UnknownRequestUriError,
} from '#/lib/api.ts'
import { JsonErrorResponse } from '#/lib/json-client.ts'

export function useErrorMessage(error: unknown): string {
  // Matches the order of the error checks in the API's parseError method (must
  // be from most specific to least specific to avoid unreachable code paths).
  const { t } = useLingui()

  if (error instanceof SecondAuthenticationFactorRequiredError) {
    return t`A second authentication factor is required`
  }

  if (error instanceof InvalidCredentialsError) {
    return t`Wrong identifier or password`
  }

  if (error instanceof InvalidInviteCodeError) {
    return t`The invite code is not valid`
  }

  if (error instanceof HandleUnavailableError) {
    switch (error.reason) {
      case 'syntax':
        return t`The handle is invalid`
      case 'domain':
        return t`The domain name is not allowed`
      case 'slur':
        return t`The handle contains inappropriate language`
      case 'taken':
        if (error.description === 'Reserved handle') {
          return t`This handle is reserved`
        }
        return t`The handle is already in use`
      default:
        return t`That handle cannot be used`
    }
  }

  if (error instanceof EmailTakenError) {
    return t`This email is already used`
  }

  if (
    error instanceof UnauthorizedError ||
    error instanceof UnknownRequestUriError ||
    error instanceof RequestExpiredError
  ) {
    return t`This sign-in session has expired`
  }

  if (error instanceof InvalidRequestError) {
    return t`The data you submitted is invalid. Please check the form and try again.`
  }

  if (error instanceof AccessDeniedError) {
    return t`This authorization request has been denied. Please try again.`
  }

  if (error instanceof JsonErrorResponse) {
    return t`Unexpected server response`
  }

  return t`An unknown error occurred`
}
