import { cookies } from '../cookies.ts'

export function useCsrfToken(cookieName: string) {
  return cookies[cookieName]
}
