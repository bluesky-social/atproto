import { ReactNode, memo } from 'react'
import { FetchError } from '@atproto-labs/fetch'
import {
  HandleUnavailableError,
  InvalidCredentialsError,
  RequestExpiredError,
  SecondAuthenticationFactorRequiredError,
  UnknownRequestUriError,
} from '../../lib/api'
import { JsonErrorResponse } from '../../lib/json-client'

export type ApiErrorMessageProps = {
  error: Error
}

export const ApiErrorMessage = memo(function ApiErrorMessage({
  error,
}: ApiErrorMessageProps): ReactNode {
  if (error instanceof InvalidCredentialsError) {
    // @TODO translate this
    return 'Invalid username or password'
  }

  if (error instanceof HandleUnavailableError) {
    // @TODO translated message based on `error.reason`
    switch (error.reason) {
      case 'syntax':
        return 'The handle contains invalid characters'
      case 'domain':
        return 'The domain name is not allowed'
      case 'slur':
        return 'The handle contains inappropriate language'
      case 'taken':
        if (error.description === 'Reserved handle') {
          return 'This handle is reserved'
        }
        return 'The handle is already in use'
      default:
        return error.description || 'That handle cannot be used'
    }
  }

  if (error instanceof SecondAuthenticationFactorRequiredError) {
    // @TODO translate this
    return 'A second authentication factor is required'
  }

  if (
    error instanceof UnknownRequestUriError ||
    error instanceof RequestExpiredError
  ) {
    // @TODO translate this
    return 'This sign-in session has expired'
  }

  if (error instanceof JsonErrorResponse) {
    // @TODO translate this
    return `Unexpected server response`
  }

  if (error instanceof FetchError) {
    // @TODO translate this
    return `Unexpected network error`
  }

  // @TODO translate this
  return 'An unknown error occurred'
})
