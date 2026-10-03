import { ref } from 'vue'

// One app-wide choice; it is never saved with the workspace.
const STORAGE_KEY = 'phlynx-unit-display'
const UNIT_DISPLAYS = ['base', 'builtIn']
const DEFAULT_UNIT_DISPLAY = 'builtIn'

function loadStoredUnitDisplay() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (UNIT_DISPLAYS.includes(stored)) return stored
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - fall back to default
  }
  return DEFAULT_UNIT_DISPLAY
}

const unitDisplay = ref(loadStoredUnitDisplay())

/**
 * Sets how units suggestions show each units, and remembers it.
 *
 * @param {'base'|'builtIn'} value - SI base units, or CellML's built-in units as the definitions wrote them.
 */
function setUnitDisplay(value) {
  if (!UNIT_DISPLAYS.includes(value)) return
  unitDisplay.value = value
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch (e) {
    // ignore storage errors
  }
}

export function useUnitDisplay() {
  return { unitDisplay, setUnitDisplay }
}
