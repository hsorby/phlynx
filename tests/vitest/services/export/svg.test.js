import { describe, expect, it } from 'vitest'

import { SVG_ICONS, el, escapeXml, fitText, num, parseRgb, resolveRadius } from '../../../../src/services/export/svg'

// A fixed-pitch font: every character is 10 units wide.
const measure = (text) => text.length * 10

describe('SVG export helpers', () => {
  it('escapes text for content and attributes', () => {
    expect(escapeXml(`a<b> & "c" 'd'`)).toBe('a&lt;b&gt; &amp; &quot;c&quot; &apos;d&apos;')
  })

  it('writes numbers with at most two decimals', () => {
    expect(num(1.23456)).toBe('1.23')
    expect(num(-0.5)).toBe('-0.5')
    expect(num(3)).toBe('3')
  })

  it('builds elements, dropping empty attributes', () => {
    expect(el('rect', { x: 1.005, y: 2, fill: '#fff', stroke: null, rx: undefined, id: '' })).toBe('<rect x="1" y="2" fill="#fff"/>')
    expect(el('text', { 'font-family': '"Helvetica Neue", Arial' }, 'a &amp; b')).toBe(
      '<text font-family="&quot;Helvetica Neue&quot;, Arial">a &amp; b</text>'
    )
  })

  it('shortens text with an ellipsis as CSS does', () => {
    expect(fitText('short', 100, measure)).toBe('short')
    expect(fitText('abcdefghij', 60, measure)).toBe('abcde…')
    expect(fitText('abc def ghi', 60, measure)).toBe('abc d…')
    expect(fitText('abcdefghij', 60, measure, false)).toBe('abcdef')
    expect(fitText('abcdefghij', 10, measure)).toBe('…')
    expect(fitText('abcdefghij', 5, measure)).toBe('')
  })

  it('resolves border radii, capped at half the shorter side', () => {
    expect(resolveRadius('10px', 200, 100)).toBe(10)
    expect(resolveRadius('50%', 14, 14)).toBe(7)
    expect(resolveRadius('999px', 40, 20)).toBe(10)
    expect(resolveRadius('0px', 40, 20)).toBe(0)
  })

  it('reads rgb colours in both syntaxes and treats transparent as nothing', () => {
    expect(parseRgb('rgb(255, 0, 16)')).toEqual({ hex: '#ff0010', opacity: 1 })
    expect(parseRgb('rgba(51, 65, 85, 0.7)')).toEqual({ hex: '#334155', opacity: 0.7 })
    expect(parseRgb('rgb(51 65 85 / 40%)')).toEqual({ hex: '#334155', opacity: 0.4 })
    expect(parseRgb('rgba(0, 0, 0, 0)')).toBeNull()
    expect(parseRgb('color(srgb 0.2 0.3 0.4)')).toBeUndefined()
  })

  it('has a path for the icons the instance card uses', () => {
    for (const name of ['pi-box', 'pi-file']) expect(SVG_ICONS[name]).toMatch(/^M/)
  })
})
