import fs from 'fs'
import path from 'path'

const glossaryPath = path.resolve('./docs/phlynx-glossary.md')
const outputPath = path.resolve('./docs/glossary.json')

const md = fs.readFileSync(glossaryPath, 'utf8')

const entryRegex = /##\s+.+?\s+\{#(.+?)\}\n([\s\S]*?)(?=\n##|\n$)/g
const entries = {}
let match

while ((match = entryRegex.exec(md))) {
  const [, id, content] = match

  const aliasMatch = content.match(/<!--\s*aliases:\s*(.*?)\s*-->/)
  const aliases = aliasMatch
    ? aliasMatch[1].split(',').map(a => a.trim())
    : []

  const definition = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
    .split('\n')
    .filter(l => l.trim())
    .slice(0, 2)
    .join(' ')

  entries[id] = { definition, aliases }
}

fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2))
