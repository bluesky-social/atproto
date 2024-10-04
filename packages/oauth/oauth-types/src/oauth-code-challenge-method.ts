import { z } from 'zod'

export const oauthCodeChallengeMethodSchema = z.enum(['S256', 'plain'])
