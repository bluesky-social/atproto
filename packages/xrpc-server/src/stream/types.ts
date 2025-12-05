import { z } from 'zod'

export enum FrameType {
  Message = 1,
  Error = -1,
}

export const messageFrameHeader = z.object({
  op: z.literal(FrameType.Message), // Frame op
  t: z.string().optional(), // Message body type discriminator
})
export type MessageFrameHeader = z.infer<typeof messageFrameHeader>

export const errorFrameHeader = z.object({
  op: z.literal(FrameType.Error),
})
export const errorFrameBody = z.object({
  error: z.string(), // Error code
  message: z.string().optional(), // Error message
})
export type ErrorFrameHeader = z.infer<typeof errorFrameHeader>
export type ErrorFrameBody<T extends string = string> = { error: T } & z.infer<
  typeof errorFrameBody
>

export const frameHeader = z.union([messageFrameHeader, errorFrameHeader])
export type FrameHeader = z.infer<typeof frameHeader>
