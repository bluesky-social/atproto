import { z } from 'zod'

export const emailOtpSchema = z.string().min(1)
