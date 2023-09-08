export const SECOND = 1000
export const MINUTE = SECOND * 60
export const HOUR = MINUTE * 60
export const DAY = HOUR * 24

export const lessThanAgoMs = (time: Date, range: number) => {
  return Date.now() < time.getTime() + range
}
