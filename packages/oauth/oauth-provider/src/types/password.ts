import { z } from 'zod'

export const oldPasswordSchema = z.string().min(1)
export const newPasswordSchema = z.string().min(8)
