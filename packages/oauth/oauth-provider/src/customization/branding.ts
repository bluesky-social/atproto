import { z } from 'zod'
import { backgroundsSchema } from './background.js'
import { colorsSchema } from './colors.js'
import { linksSchema } from './links.js'

export const brandingSchema = z.object({
  name: z.string().optional(),
  logo: z.string().url().optional(),
  colors: colorsSchema.optional(),
  background: backgroundsSchema.optional(),
  links: z.array(linksSchema).optional(),
})
export type BrandingConfig = z.input<typeof brandingSchema>
export type Branding = z.infer<typeof brandingSchema>
