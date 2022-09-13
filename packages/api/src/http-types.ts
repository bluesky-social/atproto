import { def as common } from '@adxp/common'
import { def as repo } from '@adxp/repo'
import { z } from 'zod'

export const getRepoRequest = z.object({
  did: z.string(),
  from: common.strToCid.optional(),
})
export type GetRepoRequest = z.infer<typeof getRepoRequest>

export const postRepoRequest = z.object({
  did: z.string(),
})
export type PostRepoRequest = z.infer<typeof postRepoRequest>

export const describeRepoParams = z.object({
  confirmName: z.boolean().optional(),
})
export type DescribeRepoParams = z.infer<typeof describeRepoParams>

export const describeRepoResponse = z.object({
  name: z.string(),
  did: z.string(),
  didDoc: z.any(), // TODO need full?
  collections: z.array(z.string()),
  nameIsCorrect: z.boolean().optional(),
})
export type DescribeRepoResponse = z.infer<typeof describeRepoResponse>

export const listRecordsParams = z.object({
  limit: z.union([z.number(), common.strToInt]).optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  reverse: common.strToBool.optional(),
})
export type ListRecordsParams = z.infer<typeof listRecordsParams>

export const listRecordsResponse = z.object({
  records: z.array(
    z.object({
      uri: z.string(),
      value: z.any(),
    }),
  ),
})
export type ListRecordsResponse = z.infer<typeof listRecordsResponse>

export const getRecordResponse = z.object({
  uri: z.string(),
  value: z.any(),
})
export type GetRecordResponse = z.infer<typeof getRecordResponse>

export const batchWriteParams = z.object({
  writes: z.array(repo.batchWrite),
})
export type BatchWriteParams = z.infer<typeof batchWriteParams>

export const createRecordResponse = z.object({
  uri: z.string(),
})
export type CreateRecordResponse = z.infer<typeof createRecordResponse>
