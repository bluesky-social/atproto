import chalk from 'chalk'
import { registeredCommands, RegisteredCmd, CmdOpt, CATEGORIES } from './command.js'

export function usage (err: any) {
  if (err) { 
    console.log(chalk.red(`\n${err}`))
  } else {
    console.log('')
  }
  console.log(`Usage: ${chalk.bold(`bsky`)} <command> ${chalk.gray(`[opts...]`)}`)
  categoryUsage('setup')
  categoryUsage('net')
  categoryUsage('social')
  categoryUsage('posts')
  categoryUsage('interactions')
  categoryUsage('advanced')
  process.exit(err ? 1 : 0)
}

export function commandUsage (cmd: RegisteredCmd) {
  console.log(`${chalk.bold(`bsky ${cmd.name}`)}${cmdArgs(cmd)}${cmdHelp(cmd)}`)
  if (cmd.opts?.length) {
    console.log('')
    for (const opt of cmd.opts) {
      console.log(`  ${cmdOptString(opt, true)}`)
    }
  }
}

function categoryUsage (category: keyof typeof CATEGORIES) {
  console.log(`\n${chalk.bold(CATEGORIES[category])}:\n`)
  for (const cmd of registeredCommands.filter(cmd => cmd.category === category)) {
    console.log(`  ${cmd.name}${cmdArgs(cmd)}${cmdOpts(cmd)}${cmdHelp(cmd)}`)
  }
}

function cmdArgs (cmd: RegisteredCmd) {
  if (!cmd.args?.length) return ''
  const argStrings = cmd.args.map(arg => {
    if (arg.optional) return `[${arg.name}]`
    return `{${arg.name}}`
  })
  return ` ${argStrings.join(' ')}`
}

function cmdOpts (cmd: RegisteredCmd) {
  if (!cmd.opts?.length) return ''
  const optStrings = cmd.opts.map(opt => cmdOptString(opt))
  return ` ${chalk.gray(optStrings.join(' '))}`
}

function cmdOptString (opt: CmdOpt, extended = false) {
  let str = ''
  if (opt.abbr) str += `-${opt.abbr}|`
  str += `--${opt.name}`
  if (opt.type !== 'boolean') str += ' {value}'
  if (extended) {
    if (opt.help) str += `  ${opt.help}`
  } else {
    if (typeof opt.default !== 'undefined') str = `[${str}]`
  }
  return str
}

function cmdHelp (cmd: RegisteredCmd) {
  return cmd.help ? `  ${cmd.help}` : ''
}