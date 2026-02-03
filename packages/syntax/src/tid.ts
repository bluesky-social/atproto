export type TidString = string

const TID_LENGTH = 13
const TID_REGEX = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/

export function ensureValidTid<I extends string>(
  input: I,
): asserts input is I & TidString {
  if (input.length !== TID_LENGTH) {
    throw new InvalidTidError(`TID must be ${TID_LENGTH} characters`)
  }
  // simple regex to enforce most constraints via just regex and length.
  if (!TID_REGEX.test(input)) {
    throw new InvalidTidError('TID syntax not valid (regex)')
  }
}

export function isValidTid<I extends string>(input: I): input is I & TidString {
  return input.length === TID_LENGTH && TID_REGEX.test(input)
}

export class InvalidTidError extends Error {}
