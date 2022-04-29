#!/usr/bin/env node

import minimist from 'minimist'
import chalk from 'chalk'
import './commands/index.js'
import { matchCommand, runCommand } from './lib/command.js'
import { usage, commandUsage } from './lib/usage.js'

const VERSION = '0.0.1'

const args = minimist(process.argv.slice(2))
const cmd = matchCommand(args)

if (!cmd) {
  if (args.version) {
    console.log(VERSION)
    process.exit(0)
  }
  usage(args._[0] ? `Invalid command: ${args._[0]}` : false)
} else {
  if (args.h || args.help) {
    commandUsage(cmd)
  } else {
    ;(async () => {
      try {
        await runCommand(cmd, process.argv.slice(2 + cmd.nameParsed.length))
      } catch (e: any) {
        console.error(chalk.red(e.toString()))
      }
    })()
  }
}
