export type ApiErrorPayload =
  | {
      type: 'access_denied'
    }
  | {
      type: 'invalid_request'
    }
  | {
      type: 'invalid_invite_code'
    }
  | {
      type: 'request_expired'
    }
  | {
      type: 'request_expired'
    }
  | {
      type: 'invalid_credentials'
    }
  | {
      type: 'unknown_request'
    }
  | {
      type: 'email_taken'
    }
  | {
      type: 'handle_unavailable'
      reason: 'syntax' | 'domain' | 'slur' | 'taken' | string
    }
  | {
      type: 'second_authentication_factor_required'
      method: 'emailOtp'
      hint: string
    }

class ApiError extends Error {
  payload: ApiErrorPayload
  constructor(payload: ApiErrorPayload, message?: string) {
    super(message || 'ApiError')
    this.payload = payload
  }
}

export function parseApiError(json: any): ApiError | undefined {
  if (!isApiErrorShape(json)) return

  if (json.error === 'access_denied') {
    return new ApiError({
      type: 'access_denied',
    })
  } else if (json.error === 'invalid_request') {
    return new ApiError({
      type: 'invalid_request',
    })
  } else if (
    json.error_description?.startsWith('This invite code is invalid.')
  ) {
    return new ApiError({
      type: 'invalid_invite_code',
    })
  } else if (json.error_description === 'This request has expired') {
    return new ApiError({
      type: 'request_expired',
    })
  } else if (json.error_description === 'Invalid identifier or password') {
    return new ApiError({
      type: 'invalid_credentials',
    })
  } else if (json.error_description === 'Unknown request_uri') {
    return new ApiError({
      type: 'unknown_request',
    })
  } else if (json.error_description === 'Email already taken') {
    return new ApiError({
      type: 'email_taken',
    })
  } else if (
    json.error === 'handle_unavailable' &&
    typeof json.reason === 'string'
  ) {
    return new ApiError({
      type: 'handle_unavailable',
      reason: json.reason,
    })
  } else if (
    json.error === 'second_authentication_factor_required' &&
    json.type === 'emailOtp' &&
    typeof json.hint === 'string'
  ) {
    return new ApiError({
      type: 'second_authentication_factor_required',
      method: json.type,
      hint: json.hint,
    })
  }
}

export type ApiErrorShape = {
  error: string
  error_description?: string
  [key: string]: unknown
}

export function isApiErrorShape(json: any): json is ApiErrorShape {
  return (
    !!json &&
    typeof json === 'object' &&
    typeof json['error'] === 'string' &&
    (json['error_description'] === undefined ||
      typeof json['error_description'] === 'string')
  )
}
