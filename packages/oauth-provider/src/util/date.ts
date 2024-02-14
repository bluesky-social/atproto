export function dateToEpoch(date: Date = new Date()) {
  return Math.floor(date.getTime() / 1000)
}

export function dateToRelativeSeconds(date: Date) {
  return Math.floor((date.getTime() - Date.now()) / 1000)
}
