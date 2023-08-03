/**
 * This function takes a number as input and returns a Date object,
 * which is the current date and time plus the input number of hours.
 *
 * @param {number} hours - The number of hours to add to the current date and time.
 * @returns {Date} - The new Date object, which is the current date and time plus the input number of hours.
 */
export function addHoursToDate(hours: number): Date {
  const currentDate = new Date()
  currentDate.setHours(currentDate.getHours() + hours)
  return currentDate
}
