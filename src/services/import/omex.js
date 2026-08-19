import JSZip from 'jszip'

export const importOmexFile = async (importPayload, updateProgress) => {
  const omexFiles = importPayload instanceof Map ? importPayload.get('omex') : null

  if (!(omexFiles instanceof Map) || omexFiles.size === 0) {
    throw new Error('Invalid OMEX file: missing manifest.xml (0)')
  }

  const firstEntry = omexFiles.entries().next().value
  const omexFile = firstEntry?.[1]

  if (!omexFile || !omexFile?.isValid || !(omexFile?.payload instanceof ArrayBuffer)) {
    throw new Error('Invalid OMEX file: missing manifest.xml (1)')
  }

  let archive
  try {
    archive = await JSZip.loadAsync(omexFile.payload)
  } catch {
    throw new Error('Invalid OMEX file: missing manifest.xml (2)')
  }
  const manifestFile = archive.file('manifest.xml')

  if (!manifestFile) {
    throw new Error('Invalid OMEX file: missing manifest.xml (3)')
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

  if (typeof updateProgress === 'function') {
    updateProgress(100)
  }

  return {
    fileName: firstEntry?.[0],
    fileType: 'omex',
  }
}
