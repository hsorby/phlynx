import { defineStore } from 'pinia'
import { ref } from 'vue'

function arrayBufferToBase64(value) {
  if (value == null) return ''

  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return btoa(binary)
}

function base64ToArrayBuffer(value) {
  if (!value) return null

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

function normaliseArchiveEntry(entry) {
  if (!entry || !entry.location) {
    return null
  }

  return {
    location: entry.location,
    format: entry.format || 'application/octet-stream',
    payload: entry.payload ?? null,
  }
}

function encodeEntryPayload(payload) {
  if (payload == null) return null

  if (typeof payload === 'string') {
    return payload
  }

  if (payload instanceof ArrayBuffer) {
    return arrayBufferToBase64(payload)
  }

  if (ArrayBuffer.isView(payload)) {
    return arrayBufferToBase64(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength))
  }

  return null
}

function decodeEntryPayload(payload) {
  if (payload == null) return null

  if (payload instanceof ArrayBuffer) {
    return payload
  }

  if (ArrayBuffer.isView(payload)) {
    return payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
  }

  if (typeof payload === 'string') {
    return base64ToArrayBuffer(payload)
  }

  return null
}

export const useOmexStore = defineStore('omex', () => {
  const archiveName = ref('')
  const archiveType = ref('omex')
  const manifestXml = ref('')
  const archiveFiles = ref([])
  const preservedExtras = ref([])

  function resetStore() {
    archiveName.value = ''
    archiveType.value = 'omex'
    manifestXml.value = ''
    archiveFiles.value = []
    preservedExtras.value = []
  }

  function setArchive({
    archiveName: nextArchiveName = '',
    archiveType: nextArchiveType = 'omex',
    manifestXml: nextManifestXml = '',
    files = [],
    extras = [],
  } = {}) {
    archiveName.value = nextArchiveName
    archiveType.value = nextArchiveType
    manifestXml.value = nextManifestXml
    archiveFiles.value = (Array.isArray(files) ? files : [])
      .map(normaliseArchiveEntry)
      .filter(Boolean)
      .map((entry) => ({ ...entry, payload: decodeEntryPayload(entry.payload) }))
    preservedExtras.value = (Array.isArray(extras) ? extras : [])
      .map(normaliseArchiveEntry)
      .filter(Boolean)
      .map((entry) => ({ ...entry, payload: decodeEntryPayload(entry.payload) }))
  }

  function clearArchive() {
    resetStore()
  }

  function loadState(state) {
    resetStore()

    if (!state) {
      return
    }

    setArchive({
      archiveName: state.archiveName || '',
      archiveType: state.archiveType || 'omex',
      manifestXml: state.manifestXml || '',
      files: (state.archiveFiles || []).map((entry) => ({
        ...entry,
        payload: entry.payload,
      })),
      extras: (state.preservedExtras || []).map((entry) => ({
        ...entry,
        payload: entry.payload,
      })),
    })
  }

  function getState() {
    return {
      archiveName: archiveName.value,
      archiveType: archiveType.value,
      manifestXml: manifestXml.value,
      archiveFiles: archiveFiles.value.map((entry) => ({
        ...entry,
        payload: encodeEntryPayload(entry.payload),
      })),
      preservedExtras: preservedExtras.value.map((entry) => ({
        ...entry,
        payload: encodeEntryPayload(entry.payload),
      })),
    }
  }

  return {
    archiveName,
    archiveType,
    manifestXml,
    archiveFiles,
    preservedExtras,
    resetStore,
    setArchive,
    clearArchive,
    loadState,
    getState,
  }
})
