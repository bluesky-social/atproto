import pino from 'pino'

const allSystemsEnabled = !process.env.LOG_SYSTEMS
const enabledSystems = (process.env.LOG_SYSTEMS || '').split(' ')

const config = {
  enabled: !!process.env.LOG_ENABLED,
  level: process.env.LOG_LEVEL || 'info',
}

const rootLogger = process.env.LOG_DESTINATION
  ? pino(config, pino.destination(process.env.LOG_DESTINATION))
  : pino(config)

const subsystems: Record<string, pino.Logger> = {}

export const subsystemLogger = (name: string): pino.Logger => {
  if (subsystems[name]) return subsystems[name]
  const enabled = allSystemsEnabled || enabledSystems.indexOf(name) > -1
  subsystems[name] = rootLogger.child({ name, enabled })
  return subsystems[name]
}
