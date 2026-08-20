import JSZip from 'jszip'
import { isModuleConfigFile } from './omexClassifiers'

export const importOmexFile = async (importPayload, updateProgress) => {
  const omexFiles = importPayload instanceof Map ? importPayload.get('omex') : null

  if (!(omexFiles instanceof Map) || omexFiles.size === 0) {
    throw new Error('Invalid OMEX file: does not contain any files')
  }

  const firstEntry = omexFiles.entries().next().value
  const omexFile = firstEntry?.[1]

  if (!omexFile || !omexFile?.isValid || !(omexFile?.payload instanceof ArrayBuffer)) {
    throw new Error('Invalid OMEX file: is not a valid ArrayBuffer')
  }

  let archive
  try {
    archive = await JSZip.loadAsync(omexFile.payload)
  } catch {
    throw new Error('Invalid OMEX file: is not a valid ZIP archive')
  }
  const manifestFile = archive.file('manifest.xml')

  if (!manifestFile) {
    throw new Error('Invalid OMEX file: missing manifest.xml')
  }

  const manifestText = await manifestFile.async('string')
  const manifestDocument = new DOMParser().parseFromString(manifestText, 'application/xml')
  const parserError = manifestDocument.getElementsByTagName('parsererror')[0]

  if (parserError) {
    throw new Error('Invalid OMEX file: manifest.xml is not valid XML')
  }

  const rootElement = manifestDocument.documentElement
  const expectedNamespace = 'http://identifiers.org/combine.specifications/omex-manifest'

  if (rootElement?.localName !== 'omexManifest' || rootElement?.namespaceURI !== expectedNamespace) {
    throw new Error('Invalid OMEX file: manifest.xml is not a valid omexManifest')
  }

  const foundFiles = {}
  for (const contentElement of rootElement.getElementsByTagNameNS(expectedNamespace, 'content')) {
    let location = contentElement.getAttribute('location')
    const format = contentElement.getAttribute('format')

    if (!location || !format) {
      throw new Error('Invalid OMEX file: manifest.xml contains a content entry missing location or format')
    }

    if (location.startsWith('./')) {
      location = location.slice(2)
    }

    const fileObject = archive.file(location)
    if (location !== '.' && !fileObject) {
      throw new Error(`Invalid OMEX file: manifest.xml references missing file "${location}"`)
    }

    if (format === 'http://identifiers.org/combine.specifications/cellml') {
      foundFiles.cellml = location
    } else if (format === 'http://identifiers.org/combine.specifications/sed-ml') {
      foundFiles.sedml = location
    } else if (format === 'http://purl.org/NET/mediatypes/application/json' || format === 'application/json') {
      if (await isModuleConfigFile(fileObject)) {
        foundFiles.moduleConfig = location
      } else {
        foundFiles.simulationJson = location
      }
    } else if (format === 'http://purl.org/NET/mediatypes/text/csv' || format === 'text/csv') {
      foundFiles.parameterSets = location
    }
  }

  // for (const file in archive.files) {
  //   console.log('Checking file in archive:', file)
  // }

  if (typeof updateProgress === 'function') {
    updateProgress(100)
  }

  return {
    fileName: firstEntry?.[0] || 'unknown.omex',
    files: foundFiles,
    // manifest: manifestDocument,
    fileType: 'omex',
  }
}
