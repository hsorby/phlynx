// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'phlynx-unit-display'

/** A fresh copy of the module, so it reads localStorage again. */
async function load() {
  vi.resetModules()
  const { useUnitDisplay } = await import('../../../src/composables/useUnitDisplay')
  return useUnitDisplay()
}

describe('useUnitDisplay', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('defaults to CellML built-in units', async () => {
    expect((await load()).unitDisplay.value).toBe('builtIn')
  })

  it('reads the stored choice', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'base')
    expect((await load()).unitDisplay.value).toBe('base')
  })

  it('falls back to built-in units for an unknown stored value', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'simplified')
    expect((await load()).unitDisplay.value).toBe('builtIn')
  })

  it('falls back to built-in units when storage cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect((await load()).unitDisplay.value).toBe('builtIn')
  })

  it('shares and remembers the choice', async () => {
    const { unitDisplay, setUnitDisplay } = await load()
    setUnitDisplay('base')
    expect(unitDisplay.value).toBe('base')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('base')

    const { useUnitDisplay } = await import('../../../src/composables/useUnitDisplay')
    expect(useUnitDisplay().unitDisplay.value).toBe('base')
  })

  it('ignores unknown choices', async () => {
    const { unitDisplay, setUnitDisplay } = await load()
    setUnitDisplay('simplified')
    expect(unitDisplay.value).toBe('builtIn')
  })

  it('still applies the choice when storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { unitDisplay, setUnitDisplay } = await load()
    expect(() => setUnitDisplay('base')).not.toThrow()
    expect(unitDisplay.value).toBe('base')
  })
})
