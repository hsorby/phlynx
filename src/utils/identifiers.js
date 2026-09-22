export const cleanName = (value) => sanitiseName(String(value ?? ''))

export function sanitiseName(name) {
  let sanitised = name
    .trim()
    .replace(/\s+/g, '_') // Replace spaces (and multiple spaces) with underscore
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove all invalid characters

  // Ensure it starts with a letter or underscore
  if (sanitised && !/^[a-zA-Z_]/.test(sanitised)) {
    sanitised = '_' + sanitised
  }

  return sanitised
}
