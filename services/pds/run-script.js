/* eslint-env node */

'use strict'
const {
  AppContext,
  envToCfg,
  envToSecrets,
  readEnv,
  scripts,
} = require('@atproto/pds')

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const scriptName = process.argv[2]
  const script = scripts[scriptName ?? '']
  if (!script) {
    throw new Error(`could not find script: ${scriptName}`)
  }
  await script(ctx, process.argv.slice(3))
  console.log('DONE')
}

main()
