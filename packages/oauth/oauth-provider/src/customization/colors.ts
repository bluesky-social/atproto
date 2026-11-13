import { z } from 'zod'
import { rgbColorSchema } from '../types/rgb-color.js'

export const COLOR_NAMES = [
  'primary',
  'error',
  'warning',
  'info',
  'success',
] as const
export type ColorName = (typeof COLOR_NAMES)[number]

// Each colour is a single RGB value. Only the primary colour gets a foreground
// (--primary-foreground), computed as black or white by WCAG contrast.
export const colorsSchema = z.object(
  Object.fromEntries(
    COLOR_NAMES.map((name) => [name, rgbColorSchema.optional()]),
  ) as Record<ColorName, z.ZodOptional<typeof rgbColorSchema>>,
)

export type Colors = z.infer<typeof colorsSchema>
