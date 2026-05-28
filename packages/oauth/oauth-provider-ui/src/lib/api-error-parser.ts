import { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { ParsedError } from '#/components/utils/error-card.tsx'
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
import { toJsonSafe } from './util.ts'

export function apiErrorParser(error: unknown): ParsedError | void {
  if (error instanceof JsonErrorResponse) {
    return {
      name: error.name,
      code: error.error,
      message: error.description,
      payload: toJsonSafe(error.payload),
      description: apiErrorMessage(error),
    }
  }
}

export function apiErrorMessage(error: unknown): undefined | MessageDescriptor {
  // Matches the order of the error checks in the API's parseError method (must
  // be from most specific to least specific to avoid unreachable code paths).

  if (!(error instanceof Error)) {
    return undefined
  }

  if (error instanceof SecondAuthenticationFactorRequiredError) {
    return msg`A second authentication factor is required`
  }

  if (error instanceof InvalidCredentialsError) {
    return msg`Wrong identifier or password`
  }

  if (error instanceof InvalidInviteCodeError) {
    return msg`The invite code is not valid`
  }

  if (error instanceof HandleUnavailableError) {
    switch (error.reason) {
      case 'syntax':
        return msg`The handle is invalid`
      case 'domain':
        return msg`The domain name is not allowed`
      case 'slur':
        return msg`The handle contains inappropriate language`
      case 'reserved':
        return msg`This handle is reserved`
      case 'taken':
        return msg`The handle is already in use`
      case 'resolution':
        return msg`The handle could not be resolved`
      default:
        return msg`That handle cannot be used`
    }
  }

  if (error instanceof EmailTakenError) {
    return msg`This email is already used`
  }

  if (
    error instanceof UnauthorizedError ||
    error instanceof UnknownRequestUriError ||
    error instanceof RequestExpiredError
  ) {
    return msg`This sign-in session has expired`
  }

  if (error instanceof InvalidRequestError) {
    return msg`The data you submitted is invalid. Please check the form and try again.`
  }

  if (error instanceof AccessDeniedError) {
    return msg`This authorization request has been denied. Please try again.`
  }

  if (error instanceof JsonErrorResponse) {
    return msg`Unexpected server response`
  }
}
