import { type Logger, type SerializerFn, destination, pino } from 'pino'

const enabled = /^(true|t|1)$/i.test(process.env.LOG_ENABLED ?? '0')
const dest = process.env.LOG_DESTINATION
const level = process.env.LOG_LEVEL || 'info'
const systems = process.env.LOG_SYSTEMS?.trim()
  ? process.env.LOG_SYSTEMS.replace(',', ' ').split(/\s+/).filter(Boolean)
  : null

const rootLogger = /*#__PURE__*/ pino(
  { enabled, level },
  dest ? destination(dest) : undefined,
)

export function createLogger(
  name: string,
  options?: {
    serializers?: { [key: string]: SerializerFn }
    msgPrefix?: string
  },
): Logger {
  // can't disable child loggers, so we just set their level to "silent"
  // to effectively turn them off
  const subsystemEnabled = !systems || systems.includes(name)
  const subsystemLevel = enabled && subsystemEnabled ? level : 'silent'

  return rootLogger.child({ name }, { ...options, level: subsystemLevel })
}

const subsystems = new Map<string, Logger>()

/**
 * @deprecated The use of singleton loggers is deprecated as they don't allow
 * for proper configuration of serializers, and are not really used across the
 * "atproto" mono repo. Indeed, whenever used, loggers are created and
 * re-exported from a central place, achieving the same effect as a singleton
 * logger, but with more flexibility. Use {@link createLogger} instead.
 */
export function subsystemLogger(name: string): Logger {
  if (subsystems.has(name)) return subsystems.get(name)!
  const logger = createLogger(name)
  subsystems.set(name, logger)
  return logger
}
