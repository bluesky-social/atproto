const TID_LENGTH = 13
const TID_REGEX = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/

export const ensureValidTid = (tid: string): void => {
  if (tid.length !== TID_LENGTH) {
    throw new InvalidTidError(`TID must be ${TID_LENGTH} characters`)
  }
  // simple regex to enforce most constraints via just regex and length.
  if (!TID_REGEX.test(tid)) {
    throw new InvalidTidError('TID syntax not valid (regex)')
  }
}

export const isValidTid = (tid: string): boolean => {
  return tid.length === TID_LENGTH && TID_REGEX.test(tid)
}

export class InvalidTidError extends Error {}
