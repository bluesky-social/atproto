import { Redis } from '../../../redis'

export type IngesterOptions = {
  host: string
  redis: Redis
  stream: string
  highWaterMark?: number
}
