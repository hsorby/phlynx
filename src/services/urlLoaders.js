import JSZip from 'jszip'
import { base64ToUtf8, base64ToBlob } from './compress'

export function createUrlLoaders({ applyWorkspaceState, importOmexFile, processImportedOmexArchive }) {
  return {
    workspace_json: async (base64) => {
      const json = JSON.parse(await base64ToUtf8(base64))
      await applyWorkspaceState(json, { source: 'url' })
    },

    omex: async (base64) => {
      const zipBlob = await base64ToBlob(base64, 'application/zip')
      console.log('Loading OMEX from URL with blob size:', zipBlob.size, zipBlob.name, zipBlob.type)
      const result = await importOmexFile({archive: zipBlob, name: 'url_imported.omex'})
      console.log('OMEX import result:', result)

      await processImportedOmexArchive(zipBlob, result)
      console.log('OMEX archive processed successfully.')
      //   const zip = await JSZip.loadAsync(zipBlob)

      //   // TODO: this currently assumes a fixed member name
      //   const cellmlEntry = zip.file('model.cellml')
      //   if (!cellmlEntry) {
      //     throw new Error('OMEX archive has no model.cellml entry.')
      //   }

      //   const content = await cellmlEntry.async('string')
      //   await loadCellMLFiles([{ content, name: 'model.cellml' }])
      // },
    },
  }
}
