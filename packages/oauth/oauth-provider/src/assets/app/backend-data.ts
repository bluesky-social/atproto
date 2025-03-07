import {
  AuthorizeData,
  AvailableLocales,
  CustomizationData,
  ErrorData,
} from './backend-types.ts'

function readBackendData<T>(key: string): T | undefined {
  const value = window[key] as T | undefined
  delete window[key] // Prevent accidental usage / potential leaks to dependencies
  return value
}

// These values are injected by the backend when it builds the
// page HTML. See "declareBackendData()" in the backend.

/** @deprecated Do not import directly. Only import this from main.tsx */
export const availableLocales =
  readBackendData<AvailableLocales>('__availableLocales')
/** @deprecated Do not import directly. Only import this from main.tsx */
export const customizationData = readBackendData<CustomizationData>(
  '__customizationData',
)
/** @deprecated Do not import directly. Only import this from main.tsx */
export const errorData = readBackendData<ErrorData>('__errorData')
/** @deprecated Do not import directly. Only import this from main.tsx */
export const authorizeData = readBackendData<AuthorizeData>('__authorizeData')
