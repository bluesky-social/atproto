const { execSync, spawn } = require('node:child_process')

function safeRun(cmd, opts = {}) {
  try {
    return execSync(cmd, { ...opts })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

function runCommandWithCleanup(cmd, args, { env, onCleanup = () => {} }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
      env: {
        ...env,
        DEV_INFRA_CONTEXT: 'true',
      },
    })

    const cleanupAndExit = (code) => {
      onCleanup()
      process.exit(code)
    }

    child.on('exit', (code) => {
      onCleanup()
      resolve(code ?? 0)
    })

    process.on('SIGINT', () => cleanupAndExit(130))
    process.on('SIGTERM', () => cleanupAndExit(143))
  })
}
module.exports = {
  runCommandWithCleanup,
  safeRun,
}
