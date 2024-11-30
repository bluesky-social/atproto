export const ensureValidTid = (tid: string): void => {
  if (tid.length !== 13) {
    throw new InvalidTidError('TID must be 13 characters')
  }
  // simple regex to enforce most constraints via just regex and length.
  if (!/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/.test(tid)) {
    throw new InvalidTidError('TID syntax not valid (regex)')
  }
}

export const isValidTid = (tid: string): boolean => {
  try {
    ensureValidTid(tid)
  } catch (err) {
    if (err instanceof InvalidTidError) {
      return false
    }
    throw err
  }

  return true
}

export class InvalidTidError extends Error {}
