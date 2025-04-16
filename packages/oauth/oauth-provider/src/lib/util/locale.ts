import { z } from 'zod'

export const localeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Invalid locale')
export type Locale = z.infer<typeof localeSchema>

export const multiLangStringSchema = z.intersection(
  z.object({ en: z.string() }), // en is required
  z.record(localeSchema, z.string().optional()),
)
export type MultiLangString = z.infer<typeof multiLangStringSchema>

export const localizedStringSchema = z.union([
  z.string(),
  multiLangStringSchema,
])
export type LocalizedString = z.infer<typeof localizedStringSchema>
