export const SECOND = 1000
export const MINUTE = SECOND * 60
export const HOUR = MINUTE * 60
export const DAY = HOUR * 24

export const lessThanAgoMs = (time: Date, range: number) => {
  return Date.now() < time.getTime() + range
}

export const addHoursToDate = (hours: number, startingDate?: Date): Date => {
  // When date is passed, clone before calling `setHours()` so that we are not mutating the original date
  const currentDate = startingDate ? new Date(startingDate) : new Date()
  currentDate.setHours(currentDate.getHours() + hours)
  return currentDate
}
