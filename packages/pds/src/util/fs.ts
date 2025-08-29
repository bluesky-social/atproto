import { RmOptions } from 'node:fs'

export const recursiveWithRetry: RmOptions = {
  recursive: true,
  maxRetries: 5,
  retryDelay: 50,
}
