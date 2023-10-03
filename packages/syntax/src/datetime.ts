export const ensureValidDatetime = (dtStr: string): void => {
  /*
  if (!isValidISODateString(dtStr)) {
    throw new InvalidDatetimeError('datetime did not parse as ISO 8601')
  }
  */
  const date = new Date(dtStr)
  if (isNaN(date.getTime())) {
    throw new InvalidDatetimeError('datetime did not parse as ISO 8601')
  }
  if (
    !/^[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-6][0-9]:[0-6][0-9](.[0-9]{1,20})?(Z|([+-][0-2][0-9]:[0-5][0-9]))$/.test(
      dtStr,
    )
  ) {
    throw new InvalidDatetimeError("datetime didn't validate via regex")
  }
  if (dtStr.length > 64) {
    throw new InvalidDatetimeError('datetime is too long (64 chars max)')
  }
  if (dtStr.endsWith('-00:00')) {
    throw new InvalidDatetimeError(
      'datetime can not use "-00:00" for UTC timezone',
    )
  }
}

// Normalize date strings to simplified ISO so that the lexical sort preserves temporal sort.
// Does *not* accept all possible strings, but will (arbitrarily) normalize no-timezone to local timezone.
export const normalizeAndEnsureValidDatetime = (dtStr: string): string => {
  const date = new Date(dtStr)
  if (isNaN(date.getTime())) {
    throw new InvalidDatetimeError(
      'datetime did not parse as any timestamp format',
    )
  }
  const iso = date.toISOString()
  ensureValidDatetime(iso)
  return iso // YYYY-MM-DDTHH:mm:ss.sssZ
}

export const isValidDatetime = (dtStr: string): boolean => {
  try {
    ensureValidDatetime(dtStr)
  } catch (err) {
    if (err instanceof InvalidDatetimeError) {
      return false
    }
    throw err
  }

  return true
}

export class InvalidDatetimeError extends Error {}
