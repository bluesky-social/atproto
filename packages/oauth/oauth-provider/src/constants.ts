// The purpose of the prefix is to provide type safety

export const DEVICE_ID_PREFIX = 'dev-'
export const DEVICE_ID_BYTES_LENGTH = 16 // 128 bits

export const SESSION_ID_PREFIX = 'ses-'
export const SESSION_ID_BYTES_LENGTH = 16 // 128 bits - only valid if device id is valid

export const REFRESH_TOKEN_PREFIX = 'ref-'
export const REFRESH_TOKEN_BYTES_LENGTH = 32 // 256 bits

export const TOKEN_ID_PREFIX = 'tok-'
export const TOKEN_ID_BYTES_LENGTH = 16 // 128 bits - used as `jti` in JWTs (cannot be forged)

export const REQUEST_ID_PREFIX = 'req-'
export const REQUEST_ID_BYTES_LENGTH = 16 // 128 bits

export const CODE_PREFIX = 'cod-'
export const CODE_BYTES_LENGTH = 32

const SECOND = 1e3
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const YEAR = 365.25 * DAY
const MONTH = YEAR / 12

/** 7 days */
export const AUTHENTICATION_MAX_AGE = 7 * DAY

/** 15 minutes */
export const EPHEMERAL_SESSION_MAX_AGE = 15 * MINUTE

/** 60 minutes */
export const TOKEN_MAX_AGE = 60 * MINUTE

/** 5 minutes */
export const AUTHORIZATION_INACTIVITY_TIMEOUT = 5 * MINUTE

/** 2 week */
export const PUBLIC_CLIENT_SESSION_LIFETIME = 2 * WEEK

/** @see {@link PUBLIC_CLIENT_SESSION_LIFETIME} */
export const PUBLIC_CLIENT_REFRESH_LIFETIME = PUBLIC_CLIENT_SESSION_LIFETIME

/** 2 years */
export const CONFIDENTIAL_CLIENT_SESSION_LIFETIME = 2 * YEAR

/** 3 months */
export const CONFIDENTIAL_CLIENT_REFRESH_LIFETIME = 3 * MONTH

/** 5 minutes */
export const PAR_EXPIRES_IN = 5 * MINUTE

/**
 * 59 seconds (should be less than a minute)
 *
 * > "A general guidance for the validity time would be less than a minute."
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9101#section-10.2 | JWT-Secured Authorization Request (JAR) - Section 10.2 (d)}
 */
export const JAR_MAX_AGE = 59 * SECOND

/** 1 minute */
export const CLIENT_ASSERTION_MAX_AGE = 1 * MINUTE

/** 3 minutes */
export const DPOP_NONCE_MAX_AGE = 3 * MINUTE

/** 5 seconds */
export const SESSION_FIXATION_MAX_AGE = 5 * SECOND

/** 1 day */
export const CODE_CHALLENGE_REPLAY_TIMEFRAME = 1 * DAY

/** 5 minutes */
export const LEXICON_REFRESH_FREQUENCY = 5 * MINUTE

export const NODE_ENV = process.env.NODE_ENV || 'production'
