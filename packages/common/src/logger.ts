import pino from 'pino'

export const logger = pino()

export const createLogger = (name: string) => {
  return logger.child({ name })
}
