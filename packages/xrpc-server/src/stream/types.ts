import { z } from 'zod'

export enum FrameType {
  Data = 1,
  Info = 2,
  Error = -1,
}

export const dataFrameHeader = z.object({
  op: z.literal(FrameType.Data), // Frame op
  t: z.number().int().optional(), // Message body type discriminator
})
export type DataFrameHeader = z.infer<typeof dataFrameHeader>

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
  dataFrameHeader,
  infoFrameHeader,
  errorFrameHeader,
])
export type FrameHeader = z.infer<typeof frameHeader>
