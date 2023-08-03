type TimeUnit =
  | 'years'
  | 'months'
  | 'weeks'
  | 'days'
  | 'hours'
  | 'minutes'
  | 'seconds'

/**
 * Adds an ISO 8601 duration to the current date and returns the resulting date.
 *
 * The function first parses the ISO 8601 duration string and then adds the duration to the current date.
 * The parsing of the ISO 8601 duration string is done via a regular expression, which extracts the parts of the duration.
 *
 * The function handles the following parts of the ISO 8601 duration:
 * - Years (Y)
 * - Months (M)
 * - Weeks (W)
 * - Days (D)
 * - Hours (H)
 * - Minutes (M)
 * - Seconds (S)
 *
 * Note: The function does not account for more complex aspects of date handling such as leap years or daylight saving time.
 *
 * @param {string} isoDuration - The ISO 8601 duration string to be added to the current date.
 * The string should follow the ISO 8601 duration format: PnYnMnDTnHnMnS.
 * Example: "P3Y6M4DT12H30M5S" for a duration of three years, six months, four days, twelve hours, thirty minutes, and five seconds.
 *
 * @param {Date} [dateParam] - The date to which the ISO 8601 duration should be added. when not specified, the current date is used.
 *
 * @throws {Error} Will throw an error if the duration string is not in the ISO 8601 format.
 *
 * @returns {Date} The date resulting from adding the ISO 8601 duration to the current date.
 *
 * @example
 * addDurationToCurrentDate("P2Y10M15DT12H30M5S");  // Returns a Date object two years, ten months, fifteen days, twelve hours, thirty minutes, and five seconds from now.
 */
export function addDurationToDate(isoDuration: string, dateParam?: Date): Date {
  const date = dateParam || new Date()

  const re =
    /P(?:([0-9]+)Y)?(?:([0-9]+)M)?(?:([0-9]+)W)?(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/

  const matches = re.exec(isoDuration)
  if (matches === null) {
    throw new Error('Invalid duration format')
  }

  const timeUnits: TimeUnit[] = [
    'years',
    'months',
    'weeks',
    'days',
    'hours',
    'minutes',
    'seconds',
  ]

  for (let i = 1; i < matches.length; i++) {
    const value = matches[i]
    if (value !== undefined) {
      const intValue = parseInt(value, 10)
      switch (timeUnits[i - 1]) {
        case 'years':
          date.setFullYear(date.getFullYear() + intValue)
          break
        case 'months':
          date.setMonth(date.getMonth() + intValue)
          break
        case 'weeks':
          date.setDate(date.getDate() + 7 * intValue)
          break
        case 'days':
          date.setDate(date.getDate() + intValue)
          break
        case 'hours':
          date.setHours(date.getHours() + intValue)
          break
        case 'minutes':
          date.setMinutes(date.getMinutes() + intValue)
          break
        case 'seconds':
          date.setSeconds(date.getSeconds() + intValue)
          break
      }
    }
  }

  return date
}
