export const ensureValidRecordKey = (rkey: string): void => {
  if (rkey.length > 512 || rkey.length < 1) {
    throw new InvalidRecordKeyError('record key must be 1 to 512 characters')
  }
  // simple regex to enforce most constraints via just regex and length.
  if (!/^[a-zA-Z0-9_~.:-]{1,512}$/.test(rkey)) {
    throw new InvalidRecordKeyError('record key syntax not valid (regex)')
  }
  if (rkey === '.' || rkey === '..')
    throw new InvalidRecordKeyError('record key can not be "." or ".."')
}

export const isValidRecordKey = (rkey: string): boolean => {
  try {
    ensureValidRecordKey(rkey)
  } catch (err) {
    if (err instanceof InvalidRecordKeyError) {
      return false
    }
    throw err
  }

  return true
}

export class InvalidRecordKeyError extends Error {}
