export function extractUnitNames(modelXml) {
  if (typeof modelXml !== 'string' || !modelXml.trim()) return []

  const doc = new DOMParser().parseFromString(modelXml, 'application/xml')
  if (doc.querySelector('parsererror')) return []

  return Array.from(doc.documentElement.children)
    .filter((el) => el.localName === 'units')
    .map((el) => el.getAttribute('name'))
    .filter(Boolean)
}

/**
 * Ranks the units names that could complete what's typed: an exact match first, then names starting with it, then
 * names containing it, each shortest first. Matching ignores case.
 *
 * @param {string} typed
 * @param {Iterable<string>} names
 * @param {number} [limit]
 * @returns {string[]} Empty when nothing is typed, or when the only match is what's already typed.
 */
export function unitSuggestions(typed, names, limit = 8) {
  const query = (typed ?? '').trim().toLowerCase()
  if (!query) return []

  const matches = []
  for (const name of names) {
    const lower = name.toLowerCase()
    const position = lower.indexOf(query)
    if (position < 0) continue
    const rank = lower === query ? 0 : position === 0 ? 1 : 2
    matches.push({ name, rank })
  }
  matches.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || a.name.localeCompare(b.name))

  if (matches.length === 1 && matches[0].name === typed) return []
  return matches.slice(0, limit).map((match) => match.name)
}
