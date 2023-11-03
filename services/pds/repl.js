'use strict' /* eslint-disable */

const { once } = require('node:events')
const { start: replStart } = require('node:repl')
const { promisify } = require('node:util')
const {
  AppContext,
  envToCfg,
  envToSecrets,
  readEnv,
} = require('@atproto/pds/dist')

const main = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const repl = replStart({ prompt: 'pds> ' })
  const setupHistory = promisify(repl.setupHistory.bind(repl))
  await setupHistory(process.env.NODE_REPL_HISTORY)
  await ctx.sequencer.start()
  repl.context.ctx = ctx
  await once(repl, 'exit')
  await ctx.sequencer.destroy()
  await ctx.backgroundQueue.destroy()
  await ctx.actorStore.close()
  await ctx.accountManager.close()
  await ctx.redisScratch?.quit()
}

main()
