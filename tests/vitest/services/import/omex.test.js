import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'

import { importOmexFile } from '../../../../src/services/import/omex.js'
import { isModuleConfig, isModuleConfigFile } from '../../../../src/services/import/omexClassifiers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resourcePath(relativePath) {
  return path.resolve(__dirname, '../../../resources', relativePath)
}

async function loadUploadStyleFile(relativePath, fileName, type = 'application/xml') {
  const fileBuffer = await readFile(resourcePath(relativePath))
  const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
  return { isValid: true, payload: arrayBuffer }
}

async function loadArchive(relativePath) {
  const fileBuffer = await readFile(resourcePath(relativePath))
  const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
  return JSZip.loadAsync(arrayBuffer)
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

    await expect(importOmexFile(importPayload)).rejects.toThrow('Invalid OMEX file: is not a valid ZIP archive')
  })

  it('loads a valid OMEX upload successfully', async () => {
    const uploadedFile = await loadUploadStyleFile('3compartment.omex', '3compartment.omex', 'application/zip')

    expect(uploadedFile.payload).toBeInstanceOf(ArrayBuffer)

    const importPayload = new Map()
    importPayload.set('omex', new Map([['3compartment.omex', uploadedFile]]))

    const updateProgress = vi.fn()

    await expect(importOmexFile(importPayload, updateProgress)).resolves.toEqual({
      fileName: '3compartment.omex',
      files: {
        cellml: '3compartment_flat.cellml',
        simulationJson: '3compartment_obs_data.json',
        parameterSets: '3compartment_params_for_id.csv',
        moduleConfig: 'module_config.json',
      },
      fileType: 'omex',
    })

    expect(updateProgress).toHaveBeenCalledWith(100)
  })

  it('recognizes module config object shape', () => {
    const moduleConfigJson = {
      version: 1,
      source: 'PhLynx',
      model: '3compartment',
      modules: [
        { name: 'heart', type: 'module' },
        { name: 'aortic_root', type: 'vessel' },
      ],
    }
    const nonModuleConfigJson = {
      some: 'other payload',
      modules: [{ id: 'missing required keys' }],
    }

    expect(isModuleConfig(moduleConfigJson)).toBe(true)
    expect(isModuleConfig(nonModuleConfigJson)).toBe(false)
    expect(isModuleConfig(null)).toBe(false)
    expect(isModuleConfig([])).toBe(false)
  })

  it('recognizes module_config.json file from OMEX archive', async () => {
    const archive = await loadArchive('3compartment.omex')

    const moduleConfigFile = archive.file('module_config.json')
    const simulationFile = archive.file('3compartment_obs_data.json')

    expect(moduleConfigFile).toBeTruthy()
    expect(simulationFile).toBeTruthy()

    await expect(isModuleConfigFile(moduleConfigFile)).resolves.toBe(true)
    await expect(isModuleConfigFile(simulationFile)).resolves.toBe(false)
  })
})
