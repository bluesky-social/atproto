import { OzoneDaemon, envToCfg, envToSecrets, readEnv } from '@atproto/ozone'

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const daemon = await OzoneDaemon.create(cfg, secrets)

  await daemon.start()
  process.on('SIGTERM', async () => {
    await daemon.destroy()
  })
}

main()
