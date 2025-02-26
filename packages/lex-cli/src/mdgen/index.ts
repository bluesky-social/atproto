import fs from 'node:fs'
import { type LexiconDoc } from '@atproto/lexicon'

const INSERT_START = [
  '<!-- START lex generated content. Please keep comment here to allow auto update -->',
  "<!-- DON'T EDIT THIS SECTION! INSTEAD RE-RUN lex TO UPDATE -->",
]
const INSERT_END = [
  '<!-- END lex generated TOC please keep comment here to allow auto update -->',
]

export async function process(outFilePath: string, lexicons: LexiconDoc[]) {
  let existingContent = ''
  try {
    existingContent = fs.readFileSync(outFilePath, 'utf8')
  } catch (e) {
    // ignore - no existing content
  }
  const fileLines: StringTree = existingContent.split('\n')

  // find previously generated content
  let startIndex = fileLines.findIndex((line) => matchesStart(line))
  let endIndex = fileLines.findIndex((line) => matchesEnd(line))
  if (startIndex === -1) {
    startIndex = fileLines.length
  }
  if (endIndex === -1) {
    endIndex = fileLines.length
  }

  // generate & insert content
  fileLines.splice(startIndex, endIndex - startIndex + 1, [
    INSERT_START,
    await genMdLines(lexicons),
    INSERT_END,
  ])

  fs.writeFileSync(outFilePath, merge(fileLines), 'utf8')
}

async function genMdLines(lexicons: LexiconDoc[]): Promise<StringTree> {
  const doc: StringTree = []
  for (const lexicon of lexicons) {
    console.log(lexicon.id)
    const desc: StringTree = []
    if (lexicon.description) {
      desc.push(lexicon.description, ``)
    }
    doc.push([
      `---`,
      ``,
      `## ${lexicon.id}`,
      '',
      desc,
      '```json',
      JSON.stringify(lexicon, null, 2),
      '```',
    ])
  }
  return doc
}

type StringTree = (StringTree | string | undefined)[]
function merge(arr: StringTree): string {
  return arr
    .flat(10)
    .filter((v) => typeof v === 'string')
    .join('\n')
}

function matchesStart(line) {
  return /<!-- START lex /.test(line)
}

function matchesEnd(line) {
  return /<!-- END lex /.test(line)
}
