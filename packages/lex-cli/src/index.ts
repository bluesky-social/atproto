#!/usr/bin/env node

import path from 'path'
import { Command } from 'commander'
import yesno from 'yesno'
import {
  readAllLexicons,
  genTsObj,
  genFileDiff,
  printFileDiff,
  applyFileDiff,
} from './util'
import * as mdGen from './mdgen'
import { genClientApi } from './codegen/client'
import { genServerApi } from './codegen/server'

const program = new Command()
program.name('lex').description('Lexicon CLI').version('0.0.0')

program
  .command('gen-md')
  .description('Generate markdown documentation')
  .argument('<outfile>', 'path of the file to write to', toPath)
  .argument('<lexicons...>', 'paths of the lexicon files to include', toPaths)
  .action(async (outFilePath: string, lexiconPaths: string[]) => {
    if (!outFilePath.endsWith('.md')) {
      console.error('Must supply the path to a .md file as the first parameter')
      process.exit(1)
    }
    console.log('Writing', outFilePath)
    const ok = await yesno({
      question: 'Are you sure you want to continue? [y/N]',
      defaultValue: false,
    })
    if (!ok) {
      console.log('Aborted.')
      process.exit(0)
    }
    const lexicons = readAllLexicons(lexiconPaths)
    await mdGen.process(outFilePath, lexicons)
  })

program
  .command('gen-ts-obj')
  .description('Generate a TS file that exports an array of lexicons')
  .argument('<lexicons...>', 'paths of the lexicon files to include', toPaths)
  .action((lexiconPaths: string[]) => {
    const lexicons = readAllLexicons(lexiconPaths)
    console.log(genTsObj(lexicons))
  })

program
  .command('gen-api')
  .description('Generate a TS client API')
  .argument('<outdir>', 'path of the directory to write to', toPath)
  .argument('<lexicons...>', 'paths of the lexicon files to include', toPaths)
  .action(async (outDir: string, lexiconPaths: string[]) => {
    const lexicons = readAllLexicons(lexiconPaths)
    const api = await genClientApi(lexicons)
    const diff = genFileDiff(outDir, api)
    console.log('This will write the following files:')
    printFileDiff(diff)
    const ok = await yesno({
      question: 'Are you sure you want to continue? [y/N]',
      defaultValue: false,
    })
    if (!ok) {
      console.log('Aborted.')
      process.exit(0)
    }
    applyFileDiff(diff)
    console.log('API generated.')
  })

program
  .command('gen-server')
  .description('Generate a TS server API')
  .argument('<outdir>', 'path of the directory to write to', toPath)
  .argument('<lexicons...>', 'paths of the lexicon files to include', toPaths)
  .action(async (outDir: string, lexiconPaths: string[]) => {
    const lexicons = readAllLexicons(lexiconPaths)
    const api = await genServerApi(lexicons)
    const diff = genFileDiff(outDir, api)
    console.log('This will write the following files:')
    printFileDiff(diff)
    const ok = await yesno({
      question: 'Are you sure you want to continue? [y/N]',
      defaultValue: false,
    })
    if (!ok) {
      console.log('Aborted.')
      process.exit(0)
    }
    applyFileDiff(diff)
    console.log('API generated.')
  })

program.parse()

function toPath(v: string) {
  return v ? path.resolve(v) : undefined
}

function toPaths(v: string, acc: string[]) {
  acc = acc || []
  acc.push(path.resolve(v))
  return acc
}
