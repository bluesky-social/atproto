import { useMemo } from 'react'
import { cookies } from '../cookies'

export function useCsrfToken(cookieName: string) {
  return useMemo(() => cookies[cookieName], [cookieName])
}
