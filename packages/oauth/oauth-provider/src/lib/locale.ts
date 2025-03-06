import { z } from 'zod'

export const localeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Invalid locale')
export type Locale = z.infer<typeof localeSchema>

export const multiLangStringSchema = z.intersection(
  z.object({ en: z.string() }), // en is required
  z.record(localeSchema, z.union([z.string(), z.undefined()])),
)
export type MultiLangString = z.infer<typeof multiLangStringSchema>

export const AVAILABLE_LOCALES = [
  // TODO: Add more in this list as translations are added in the PO files
  'en',
  'fr',
] as const satisfies readonly Locale[]
export type AvailableLocale = (typeof AVAILABLE_LOCALES)[number]
export const isAvailableLocale = (v: unknown): v is AvailableLocale =>
  (AVAILABLE_LOCALES as readonly unknown[]).includes(v)
