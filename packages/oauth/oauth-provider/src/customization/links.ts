import { z } from 'zod'
import { isLinkRel } from '../lib/html/build-document.js'
import { localizedStringSchema } from '../lib/util/locale.js'

export const linksSchema = z.object({
  title: localizedStringSchema,
  href: z.string().url(),
  rel: z.string().refine(isLinkRel, 'Invalid link rel').optional(),
})
export type Links = z.infer<typeof linksSchema>
