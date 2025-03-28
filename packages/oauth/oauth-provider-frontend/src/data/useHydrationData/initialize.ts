import type { AuthorizeData, CustomizationData, ErrorData } from '#/api'

declare global {
  interface Window {
    [key: string]: unknown
  }
}

function getWindowValue<T>(key: string): T | undefined {
  if (key in window) {
    const value = window[key] as T
    delete window[key] // Prevent accidental usage / potential leaks to dependencies
    return value
  }
}

export const customizationData = getWindowValue<CustomizationData>(
  '__customizationData',
)
export const authorizationData =
  getWindowValue<AuthorizeData>('__authorizeData')
export const errorData = getWindowValue<ErrorData>('__errorData')
