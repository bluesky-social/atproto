import { cookies } from '../cookies'

export function useCsrfToken(cookieName: string) {
  return cookies[cookieName]
}
