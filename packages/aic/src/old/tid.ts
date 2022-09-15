import { TidString } from './types'

// example tid
// 3j5s-z6d-c2hy-22 2022-07-14T18:08:06.693310
// 3j5s-z6d-2222-22 2022-07-14T18:08:06.430720
// 3j5s-222-2222-22 2022-07-14T08:50:56.779264
// 3j52-222-2222-22 2022-07-04T19:47:03.058432
// 3j22-222-2222-22 2022-05-27T15:31:28.175104
// 3222-222-2222-22 2005-09-05T05:58:26.842624

const S32_CHAR = '234567abcdefghijklmnopqrstuvwxyz'

// clock '2*' no check out clockIDs
// clock 'z*' reserved for consensus clockIDs
// clock '[3-y]*' repo checked out clockIDs
const CLOCK_ID = '2' + S32_CHAR[(Math.random() * 32) | 0] // clock '2*'
let latest = 0 // microseconds since 1970 UTC

export const tid = (): TidString => {
  const now = Number(Date.now()) * 1000
  latest = now > latest ? now : latest + 1
  let microseconds = latest
  let id = ''
  for (let devisor = Math.pow(2, 50); devisor >= 1; devisor /= 32) {
    // 11 char b32 leading '2's if needed
    id += S32_CHAR[(microseconds / devisor) | 0]
    microseconds = microseconds % devisor
  }
  return `${id.slice(0, 4)}-${id.slice(4, 7)}-${id.slice(7, 11)}-${CLOCK_ID}`
}

const tidToSec = (tid: TidString): number => {
  // 3j5s-z6d-c2hy-22
  // 3j5s-z6d first 7 char represent ~ seconds
  const s = tid.replace(/-/g, '')
  return (
    (((((S32_CHAR.indexOf(s[0]) * 32 + S32_CHAR.indexOf(s[1])) * 32 +
      S32_CHAR.indexOf(s[2])) *
      32 +
      S32_CHAR.indexOf(s[3])) *
      32 +
      S32_CHAR.indexOf(s[4])) *
      32 +
      S32_CHAR.indexOf(s[5])) *
      32 +
    S32_CHAR.indexOf(s[6])
  )
}

const tidDifferenceSeconds = (tid1: TidString, tid2: TidString): number => {
  return tidToSec(tid1) - tidToSec(tid2)
}

export const tidDifferenceHours = (
  tid1: TidString,
  tid2: TidString,
): number => {
  return tidDifferenceSeconds(tid1, tid2) / 60 / 60
}
