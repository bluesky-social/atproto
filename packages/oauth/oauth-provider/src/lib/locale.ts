import { z } from 'zod'

export const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid locale')
export type Locale = z.infer<typeof localeSchema>

export const multiLangStringSchema = z.intersection(
  z.object({ en: z.string() }), // en is required
  z.record(localeSchema, z.union([z.string(), z.undefined()])),
)
export type MultiLangString = z.infer<typeof multiLangStringSchema>
