import { sanitiseName } from '../utils/nodes'

/**
 * Read a File object as text.
 */
export const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })

export function sanitiseNameOnBlur(name) {
  console.log('sanitiseNameOnBlur', name)
  if (name && name?.trim()) {
    const sanitised = sanitiseName(name)
    if (sanitised) {
      name = sanitised
    }
  }
}
