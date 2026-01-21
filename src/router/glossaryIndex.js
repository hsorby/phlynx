import glossary from '../../docs/glossary.json'

const aliasMap = {}
for (const [key, entry] of Object.entries(glossary)) {
  aliasMap[key.toLowerCase()] = key
  entry.aliases.forEach(a => {
    aliasMap[a.toLowerCase()] = key
  })
}

export function resolveTerm(term) {
  return aliasMap[term.toLowerCase()]
}

export function getDefinition(term) {
  return glossary[term]?.definition
}