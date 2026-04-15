import { l } from '@atproto/lex-schema'

export enum FrameType {
  Message = 1,
  Error = -1,
}

export const messageFrameHeader = l.object({
  op: l.literal(FrameType.Message), // Frame op
  t: l.optional(l.string()), // Message body type discriminator
})
export type MessageFrameHeader = l.Infer<typeof messageFrameHeader>

export const errorFrameHeader = l.object({
  op: l.literal(FrameType.Error),
})
export const errorFrameBody = l.object({
  error: l.string(), // Error code
  message: l.optional(l.string()), // Error message
})
export type ErrorFrameHeader = l.Infer<typeof errorFrameHeader>
export type ErrorFrameBody<T extends string = string> = { error: T } & l.Infer<
  typeof errorFrameBody
>

export const frameHeader = l.union([messageFrameHeader, errorFrameHeader])
export type FrameHeader = l.Infer<typeof frameHeader>
