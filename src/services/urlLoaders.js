import JSZip from 'jszip'
import { base64ToUtf8, base64ToBlob } from './compress'

export function createUrlLoaders({ applyWorkspaceState, loadCellMLFiles }) {
  return {
    workspace_json: async (base64) => {
      const json = JSON.parse(await base64ToUtf8(base64))
      await applyWorkspaceState(json, { source: 'url' })
    },

    omex: async (base64) => {
      const zipBlob = await base64ToBlob(base64, 'application/zip')
      const zip = await JSZip.loadAsync(zipBlob)

      // TODO: this currently assumes a fixed member name
      const cellmlEntry = zip.file('model.cellml')
      if (!cellmlEntry) {
        throw new Error('OMEX archive has no model.cellml entry.')
      }

      const content = await cellmlEntry.async('string')
      await loadCellMLFiles([{ content, name: 'model.cellml' }])
    },
  }
}
