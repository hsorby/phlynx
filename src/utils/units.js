export function extractUnitNames(modelXml) {
  if (typeof modelXml !== 'string' || !modelXml.trim()) return []

  const doc = new DOMParser().parseFromString(modelXml, 'application/xml')
  if (doc.querySelector('parsererror')) return []

  return Array.from(doc.documentElement.children)
    .filter((el) => el.localName === 'units')
    .map((el) => el.getAttribute('name'))
    .filter(Boolean)
}
