import { type Logger, destination, pino } from 'pino'

const enabled = /^(true|t|1)$/i.test(process.env.LOG_ENABLED ?? '0')
const dest = process.env.LOG_DESTINATION
const level = process.env.LOG_LEVEL || 'info'
const systems = process.env.LOG_SYSTEMS?.trim()
  ? process.env.LOG_SYSTEMS.replace(',', ' ').split(/\s+/).filter(Boolean)
  : null

const rootLogger = pino(
  { enabled, level },
  dest ? destination(dest) : undefined,
)

const subsystems = new Map<string, Logger>()

export const subsystemLogger = (name: string): Logger => {
  if (subsystems.has(name)) return subsystems.get(name)!

  // can't disable child loggers, so we just set their level to "silent"
  // to effectively turn them off
  const subsystemEnabled = !systems || systems.includes(name)
  const subsystemLevel = enabled && subsystemEnabled ? level : 'silent'

  const logger = rootLogger.child({ name }, { level: subsystemLevel })

  subsystems.set(name, logger)
  return logger
}
