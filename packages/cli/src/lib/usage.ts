import chalk from 'chalk'
import {
  registeredCommands,
  RegisteredCmd,
  CmdOpt,
  CATEGORIES,
} from './command'

export function usage(err: any) {
  if (err) {
    console.log(chalk.red(`\n${err}`))
  } else {
    console.log('')
  }
  console.log(
    `Usage: ${chalk.bold(`atp`)} <command> ${chalk.gray(`[opts...]`)}`,
  )

  let lhsLength = 0
  const cats: any[] = []
  function addcat(category: keyof typeof CATEGORIES) {
    const lhs: string[] = []
    const rhs: string[] = []
    for (const cmd of registeredCommands.filter(
      (cmd) => cmd.category === category,
    )) {
      const l = `  ${cmd.name}${cmdArgs(cmd)}`
      lhsLength = Math.max(l.length, lhsLength)
      lhs.push(l)
      rhs.push(cmdHelp(cmd))
    }
    cats.push({ label: CATEGORIES[category], lhs, rhs })
  }
  addcat('setup')
  addcat('repo')
  addcat('social')
  addcat('posts')
  addcat('interactions')
  addcat('advanced')
  addcat('dev')
  for (const cat of cats) {
    console.log(`\n${chalk.bold(cat.label)}:\n`)
    for (let i = 0; i < cat.lhs.length; i++) {
      console.log(`${cat.lhs[i].padEnd(lhsLength)}  ${cat.rhs[i]}`)
    }
  }
}

export function commandUsage(cmd: RegisteredCmd) {
  console.log(`${chalk.bold(`atp ${cmd.name}`)}${cmdArgs(cmd)}${cmdHelp(cmd)}`)
  if (cmd.opts?.length) {
    console.log('')
    for (const opt of cmd.opts) {
      console.log(`  ${cmdOpt(opt, true)}`)
    }
  }
}

function cmdArgs(cmd: RegisteredCmd) {
  if (!cmd.args?.length) return ''
  const argStrings = cmd.args.map((arg) => {
    if (arg.optional) return `[${arg.name}]`
    return `{${arg.name}}`
  })
  return ` ${argStrings.join(' ')}`
}

function cmdOpt(opt: CmdOpt, extended = false) {
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

function cmdHelp(cmd: RegisteredCmd) {
  return cmd.help ? `  ${cmd.help}` : ''
}
