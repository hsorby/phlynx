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
          startingPoint: 10,
          endingPoint: 20,
          initialPoint: 5,
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
              type: 'constant',
              min: 0.1,
              default: 1,
              max: 10,
            },
          ],
        },
      },
      {voiInformation: {name: 'time', componentName: 'environment', units: 'seconds'}}
    )

    expect(archiveBlob).toBeInstanceOf(Blob)

    const archive = await readArchive(archiveBlob)
    const entryNames = Object.keys(archive.files).sort()

    expect(entryNames).toEqual(['document.sedml', 'manifest.xml', 'model.cellml', 'simulation.json'])

    const manifestXml = await archive.file('manifest.xml').async('string')
    expect(manifestXml).toContain('<omexManifest')
    expect(manifestXml).toContain('<content location="." format="http://identifiers.org/combine.specifications/omex"/>')
    expect(manifestXml).toContain(
      '<content location="document.sedml" format="http://identifiers.org/combine.specifications/sed-ml" master="true"/>'
    )
    expect(manifestXml).toContain(
      '<content location="model.cellml" format="http://identifiers.org/combine.specifications/cellml"/>'
    )
    expect(manifestXml).toContain('<content location="simulation.json" format="http://purl.org/NET/mediatypes/application/json"/>')

    const modelCellml = await archive.file('model.cellml').async('string')
    expect(modelCellml).toBe(cellmlSource)

    const sedmlDocument = await archive.file('document.sedml').async('string')
    expect(sedmlDocument).toContain('<sedML xmlns="http://sed-ml.org/sed-ml/level1/version4" level="1" version="4">')
    expect(sedmlDocument).toContain('<model id="model1" language="urn:sedml:language:cellml" source="model.cellml">')
    expect(sedmlDocument).toContain('<task id="task1" modelReference="model1" simulationReference="simulation1"/>')
    expect(sedmlDocument).toContain('<uniformTimeCourse id="simulation1" initialTime="5" outputStartTime="10" outputEndTime="20" numberOfSteps="10">')

    const simulationJson = await archive.file('simulation.json').async('string')
    const simulationData = JSON.parse(simulationJson)
    expect(simulationData).toHaveProperty('input')
    expect(simulationData).toHaveProperty('output')
    expect(simulationData).toHaveProperty('parameters')

    expect(simulationData.input).toEqual([
      {
        id: 'id__membrane__gNa',
        name: 'gNa',
        defaultValue: 1,
        minimumValue: 0.1,
        maximumValue: 10,
        stepValue: 0.099,
      },
    ])

    expect(simulationData.output.data).toEqual([
      {
        id: 'data__membrane__vm',
        name: 'membrane/Vm',
      },
      {
        id: 'voi__environment__time',
        name: 'environment/time',
      },
    ])

    expect(simulationData.output.plots).toEqual([
      {
        additionalTraces: [],
        name: 'Plot 1',
        xAxisTitle: '',
        xValue: 'voi__environment__time',
        yAxisTitle: '',
        yValue: 'data__membrane__vm',
      },
    ])

    expect(simulationData.parameters).toEqual([
      {
        value: 'id__membrane__gNa',
        name: 'parameters/gNa',
      },
    ])
  })
})
