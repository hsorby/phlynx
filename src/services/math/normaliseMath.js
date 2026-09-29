/**
 * Repairs stored math that older editors wrote in forms CellML doesn't allow.
 * Pure (no Vue, no DOM), so it is safe in a worker.
 */

// cellml-text-editor up to 0.3.x writes square roots as <sqrt/>, which isn't Content MathML.
const SQRT_OPERATOR = /<((?:[\w.-]+:)?)sqrt\s*(?:\/>|>\s*<\/\1sqrt>)/g

/**
 * Rewrites legacy MathML as its CellML 2.0 form: `<sqrt/>` becomes `<root/>`, which is a square
 * root when it has no `<degree>`.
 *
 * @param {string} xml - CellML model XML.
 * @returns {string} The same string when nothing needed rewriting.
 */
export function normaliseLegacyMathML(xml) {
  if (!xml || !xml.includes('sqrt')) return xml
  return xml.replace(SQRT_OPERATOR, '<$1root/>')
}
