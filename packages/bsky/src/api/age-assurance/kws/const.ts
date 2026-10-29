/**
 * Supported languages for KWS Adult Verification. This list comes from KWS's
 * Age Verification Developer Guide PDF doc.
 */
export const KWS_SUPPORTED_LANGUAGES = new Set([
  'en',
  'ar',
  'zh-Hans',
  'nl',
  'tl',
  'fr',
  'de',
  'id',
  'it',
  'ja',
  'ko',
  'pl',
  'pt-BR',
  'pt',
  'ru',
  'es',
  'th',
  'tr',
  'vi',
])

/**
 * KWS verification boundaries, with region-specific entries overriding country defaults.
 */
export const KWS_AGE_VERIFICATION_CONFIG: Record<
  string,
  { ageBoundary: number } | undefined
> = {
  AU: { ageBoundary: 16 },
  GB: { ageBoundary: 18 },
  BR: { ageBoundary: 18 },
  US: { ageBoundary: 18 },
  'US-VA': { ageBoundary: 16 },
}
