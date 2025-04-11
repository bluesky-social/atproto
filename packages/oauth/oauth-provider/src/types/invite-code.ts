import { z } from 'zod'

export const inviteCodeSchema = z.string().min(1)
export type InviteCode = z.infer<typeof inviteCodeSchema>
