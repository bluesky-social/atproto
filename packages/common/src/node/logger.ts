import pino from 'pino'

const allSystemsEnabled = !process.env.LOG_SYSTEMS
const enabledSystems = (process.env.LOG_SYSTEMS || '')
  .replace(',', ' ')
  .split(' ')

const enabledEnv = process.env.LOG_ENABLED
const enabled =
  enabledEnv === 'true' || enabledEnv === 't' || enabledEnv === '1'

const level = process.env.LOG_LEVEL || 'info'

const config = {
  enabled,
  level,
}

const rootLogger = process.env.LOG_DESTINATION
  ? pino(config, pino.destination(process.env.LOG_DESTINATION))
  : pino(config)

const subsystems: Record<string, pino.Logger> = {}

export const subsystemLogger = (name: string): pino.Logger => {
  if (subsystems[name]) return subsystems[name]
  const subsystemEnabled =
    enabled && (allSystemsEnabled || enabledSystems.indexOf(name) > -1)

  // can't disable child loggers, so we just set their level to fatal to effectively turn them off
  subsystems[name] = rootLogger.child(
    { name },
    { level: subsystemEnabled ? level : 'silent' },
  )
  return subsystems[name]
}
