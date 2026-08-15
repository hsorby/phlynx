import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { generateOmexArchive } from '../../../src/services/compress.js'

async function readArchive(blob) {
  return JSZip.loadAsync(await blob.arrayBuffer())
}

describe('generateOmexArchive', () => {
  it('builds a Web OpenCOR OMEX archive with the expected core files and contents', async () => {
    const cellmlSource = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.cellml.org/cellml/2.0#" name="test_model">
  <component name="main" />
</model>`

    const archiveBlob = await generateOmexArchive(
      {
        finalName: 'test-model.cellml',
        blob: new Blob([cellmlSource], { type: 'application/xml' }),
      },
      {
        simulationSettings: {
          startingPoint: 0,
          endingPoint: 100,
          timeStep: 1,
          pointInterval: 1,
          solver: 'CVODE',
          tolerance: 1e-7,
          maxSteps: 500,
        },
        plotConfig: {
          groups: [{ id: 'plot-1', name: 'Plot 1' }],
          selections: [
            {
              key: 'node-1::Vm',
              nodeId: 'node-1',
              nodeName: 'membrane',
              variableName: 'Vm',
              groupId: 'plot-1',
            },
          ],
        },
        parameterScanConfig: {
          selections: [
            {
              key: 'node-1::gNa',
              nodeId: 'node-1',
              nodeName: 'membrane',
              parameterName: 'gNa',
              min: 0.1,
              default: 1,
              max: 10,
            },
          ],
        },
      }
    )

    expect(archiveBlob).toBeInstanceOf(Blob)

    const archive = await readArchive(archiveBlob)
    const entryNames = Object.keys(archive.files).sort()

    expect(entryNames).toEqual(['document.sedml', 'manifest.xml', 'model.cellml'])

    const manifestXml = await archive.file('manifest.xml').async('string')
    expect(manifestXml).toContain('<omexManifest')
    expect(manifestXml).toContain('<content location="." format="http://identifiers.org/combine.specifications/omex"/>')
    expect(manifestXml).toContain(
      '<content location="document.sedml" format="http://identifiers.org/combine.specifications/sed-ml" master="true"/>'
    )
    expect(manifestXml).toContain(
      '<content location="model.cellml" format="http://identifiers.org/combine.specifications/cellml"/>'
    )

    const modelCellml = await archive.file('model.cellml').async('string')
    expect(modelCellml).toBe(cellmlSource)

    const sedmlDocument = await archive.file('document.sedml').async('string')
    expect(sedmlDocument).toContain('<sedML xmlns="http://sed-ml.org/sed-ml/level1/version4" level="1" version="4">')
    expect(sedmlDocument).toContain('<model id="model1" language="urn:sedml:language:cellml" source="model.cellml">')
    expect(sedmlDocument).toContain('<task id="task1" modelReference="model1" simulationReference="simulation1"/>')
  })
})
