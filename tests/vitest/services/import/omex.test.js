import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { importOmexFile } from '../../../../src/services/import/omex.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resourcePath(relativePath) {
  return path.resolve(__dirname, '../../../resources', relativePath)
}

async function loadUploadStyleFile(relativePath, fileName, type = 'application/xml') {
  const fileBuffer = await readFile(resourcePath(relativePath))
  const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
  return {isValid: true, payload: arrayBuffer}
}

describe('Import OMEX', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects a file upload that is not an OMEX file', async () => {
    const uploadedFile = await loadUploadStyleFile('model.cellml', 'model.cellml', 'application/xml')

    expect(uploadedFile.payload).toBeInstanceOf(ArrayBuffer)

    const importPayload = new Map()
    importPayload.set('omex', new Map([[uploadedFile.name, uploadedFile]]))

    await expect(importOmexFile(importPayload)).rejects.toThrow('Invalid OMEX file: missing manifest.xml')
  })

  it('loads a valid OMEX upload successfully', async () => {
    const uploadedFile = await loadUploadStyleFile('3compartment.omex', '3compartment.omex', 'application/zip')

    expect(uploadedFile.payload).toBeInstanceOf(ArrayBuffer)

    const importPayload = new Map()
    importPayload.set('omex', new Map([['3compartment.omex', uploadedFile]]))

    const updateProgress = vi.fn()

    await expect(importOmexFile(importPayload, updateProgress)).resolves.toEqual({
      fileName: '3compartment.omex',
      fileType: 'omex',
    })

    expect(updateProgress).toHaveBeenCalledWith(100)
  })
})
