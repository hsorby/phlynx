export const stripExtension = (filename) => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(0, lastDot) : filename
}

export const ensureExtension = (filename, extension) => {
  // should confirm that extension provided is valid
  const ext = extension.startsWith('.') ? extension : `${extension}`
  return filename.endsWith(ext) ? filename : `${stripExtension(filename)}${ext}`
}

export const legacyDownload = (filename, blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click() // Triggers the download

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

export const saveFileHandle = async (defaultName, fileTypes) => {
  if ('showSaveFilePicker' in window) {
    try {
      const safeName =
        defaultName && defaultName.trim().length > 0
          ? defaultName
          : 'phlynx-export'
      const handle = await window.showSaveFilePicker({
        suggestedName: safeName,
        fileTypes,
      })
      return { status: true, handle }
    } catch (err) {
      if (err.name === 'AbortError')
        return { status: true, handle: null }
      throw new Error(`Error saving file: ${err.message}`)
    }
  }
  return { status: false, handle: null }
}

export const writeFileHandle = async (handle, blob) => {
  try {
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  } catch (err) {
    if (err.name === 'AbortError') return true
    throw new Error(`Error writing file to disk: ${err.message}`) 
  }
}

export const getFileHandle = async (baseName, fileTypes, suffix) => {
  if ('showSaveFilePicker' in window) {
    const suggestedName = `${baseName}${suffix}`
    const result = await saveFileHandle(suggestedName, fileTypes)

    if (result.status && result.handle) {
      return {
        success: true,
        handle: result.handle,
        cleanName: stripExtension(result.handle.name),
        method: 'system'
      }
    } else if (result.status && !result.handle) {
      return { success: false, cancelled: true }
    }
  }

  return { success: false, needsLegacyDialog: true, method: 'legacy' }
}

export const saveWithDialog = async (blob, handle, baseName, suffix) => {
  if (handle) {
    await writeFileHandle(handle, blob)
    return { 
      success: true, 
      savedName: stripExtension(handle.name),
      method: 'system'
    }
  }
  const downloadName = ensureExtension(baseName, suffix)
  legacyDownload(downloadName, blob)
  return { success: true, savedName: baseName, method: 'legacy' }
}