import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { generateExportZip } from '../../../../src/services/export/ca.js'

const LIBRARY = { globalVariables: [] }

/**
 * Lists the files of an exported zip.
 *
 * @param {Blob} blob
 * @returns {Promise<Object>} Each file's text, by name.
 */
async function readZip(blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return Object.fromEntries(await Promise.all(Object.keys(zip.files).map(async (name) => [name, await zip.file(name).async('string')])))
}

describe('generateExportZip', () => {
  it("writes the workspace's obs_data beside the config, as CA names it", async () => {
    const obsData = new TextEncoder().encode('{"protocol_info": {"pre_times": [0], "sim_times": [[1]]}}\n').buffer
    const files = await readZip(await generateExportZip('heart', [], [], LIBRARY, obsData))
    expect(Object.keys(files).sort()).toEqual(['heart_module_array.csv', 'heart_module_config.json', 'heart_obs_data.json', 'heart_parameters.csv'])
    expect(files['heart_obs_data.json']).toBe('{"protocol_info": {"pre_times": [0], "sim_times": [[1]]}}\n')
  })

  it("names each config entry's CellML component, as CA's PhLynx schema needs", async () => {
    const node = {
      id: 'n1',
      data: { name: 'heart', moduleRef: 'arterial_simple:vp', mathRef: 'BG_modules.cellml:vp_simple_type', ports: [], variables: [] },
    }
    const library = { ...LIBRARY, availableModules: new Map([['arterial_simple:vp', {}]]) }
    const files = await readZip(await generateExportZip('heart', [node], [], library))
    const [entry] = JSON.parse(files['heart_module_config.json'])
    expect(entry).toMatchObject({
      module_type: 'arterial_simple',
      module_subtype: 'vp',
      component_file: 'BG_modules.cellml',
      component_type: 'vp_simple_type',
    })
  })

  it('writes no obs_data for a workspace without one', async () => {
    expect(Object.keys(await readZip(await generateExportZip('heart', [], [], LIBRARY)))).not.toContain('heart_obs_data.json')
  })
})
