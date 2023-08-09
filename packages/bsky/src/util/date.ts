/**
 * This function takes a number as input and returns a Date object,
 * which is the current date and time plus the input number of hours.
 *
 * @param {number} hours - The number of hours to add to the current date and time.
 * @param {Date} startingDate - If provided, the function will add `hours` to the provided date instead of the current date.
 * @returns {Date} - The new Date object, which is the current date and time plus the input number of hours.
 */
export function addHoursToDate(hours: number, startingDate?: Date): Date {
  // When date is passe, let's clone before calling `setHours()` so that we are not mutating the original date
  const currentDate = startingDate ? new Date(startingDate) : new Date()
  currentDate.setHours(currentDate.getHours() + hours)
  return currentDate
}
