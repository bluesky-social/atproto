import { z } from 'zod'

export enum FrameType {
  Message = 1,
  Info = 2,
  Error = -1,
}

export const messageFrameHeader = z.object({
  op: z.literal(FrameType.Message), // Frame op
  t: z.number().int().optional(), // Message body type discriminator
})
export type MessageFrameHeader = z.infer<typeof messageFrameHeader>

export const infoFrameHeader = z.object({
  op: z.literal(FrameType.Info),
})
export const infoFrameBody = z.object({
  info: z.string(), // Info code
  message: z.string().optional(), // Info message
})
export type InfoFrameHeader = z.infer<typeof infoFrameHeader>
export type InfoFrameBody<T extends string = string> = { info: T } & z.infer<
  typeof infoFrameBody
>

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

export const frameHeader = z.union([
  messageFrameHeader,
  infoFrameHeader,
  errorFrameHeader,
])
export type FrameHeader = z.infer<typeof frameHeader>

export class DisconnectError extends Error {
  constructor(
    public wsCode: CloseCode = CloseCode.Policy,
    public xrpcCode?: string,
  ) {
    super()
  }
}

// https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
export enum CloseCode {
  Normal = 1000,
  Abnormal = 1006,
  Policy = 1008,
}
