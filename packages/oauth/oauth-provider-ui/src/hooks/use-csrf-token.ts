import { cookies } from '../cookies.ts'

export function useCsrfToken(cookieName = 'csrf-token') {
  return cookies[cookieName]
}
