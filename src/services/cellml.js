import JSZip from 'jszip'

// Helper: Converts a Blob to a pure Base64 string (strips the "data:..." prefix)
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      // reader.result is like "data:application/zip;base64,UEsDB..."
      // We only want the part after the comma
      const splitResult = reader.result.split(',')
      console.log('Split result:', splitResult[0])
      const base64data = reader.result.split(',')[1]
      resolve(base64data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function createCellMLDataFragment(cellmlBlob, fileName) {
  const zip = new JSZip()
  const internalName = fileName ? (fileName.endsWith('.cellml') ? fileName : `${fileName}.cellml`) : 'model.cellml'
  zip.file(internalName, cellmlBlob)

  console.log('Generating CellML zip blob...')
  const sizeInKB1 = (cellmlBlob.size / 1024).toFixed(2)
  console.log(`CellML size: ${sizeInKB1} KB`)

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
  console.log('Generated zip blob:')
  const sizeInKB = (zipBlob.size / 1024).toFixed(2)
  console.log(`Zip size: ${sizeInKB} KB`)
  const base64String = await blobToBase64(zipBlob)
  console.log('Base64 string length:', base64String.length)

  const dataUri = `data:application/x.vnd.zip-cellml+zip;base64,${base64String}`
  return dataUri
}
