import { z } from 'zod'

export const clientIdSchema = z.string().min(1)
export type ClientId = z.infer<typeof clientIdSchema>
