import { z } from 'zod'

export enum FrameType {
  Message = 1,
  Info = 2,
  Error = -1,
}

const messageFrameHeader = z.object({
  op: z.literal(FrameType.Message), // Frame op
  id: z.string().optional(), // Mesage id for resumption
  t: z.string().optional(), // Message body type discriminator
})
export type MessageFrameHeader = z.infer<typeof messageFrameHeader>

const infoFrameHeader = z.object({
  op: z.literal(FrameType.Info),
  t: z.string().optional(), // Info body type discriminator
})
export type InfoFrameHeader = z.infer<typeof infoFrameHeader>

// No body, must disconnect
const errorFrameHeader = z.object({
  op: z.literal(FrameType.Error),
  err: z.string().optional(), // Error code
  msg: z.string().optional(), // Error message
})
export type ErrorFrameHeader = z.infer<typeof errorFrameHeader>

export const frameHeader = z.union([
  messageFrameHeader,
  infoFrameHeader,
  errorFrameHeader,
])
export type FrameHeader = z.infer<typeof frameHeader>
