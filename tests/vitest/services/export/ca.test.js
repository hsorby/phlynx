import JSZip from 'jszip'
import Papa from 'papaparse'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notified = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }))
vi.mock('../../../../src/utils/notify', () => ({ notify: notified }))

const { generateExportZip } = await import('../../../../src/services/export/ca.js')

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

/**
 * Makes a node on one library module.
 *
 * @param {string} name - The instance name, also used as its id.
 * @param {Array} variables - Its parameter rows.
 * @returns {Object}
 */
function nodeWith(name, variables) {
  return { id: name, data: { name, moduleRef: 'arterial_simple:vp', mathRef: 'BG_modules.cellml:vp_simple_type', ports: [], variables } }
}

/**
 * Reads the parameters CSV of an exported zip.
 *
 * @param {Object} files - Each file's text, by name (see readZip).
 * @returns {Object} Each row, by variable name.
 */
function parametersOf(files) {
  const { data } = Papa.parse(files['heart_parameters.csv'], { header: true, skipEmptyLines: true })
  return Object.fromEntries(data.map((row) => [row.variable_name, row]))
}

describe('generateExportZip', () => {
  beforeEach(() => vi.clearAllMocks())

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

  it('writes each boundary condition row, as CA needs one for every boundary condition', async () => {
    const node = nodeWith('out', [
      { name: 'u_out', type: 'boundary_condition', units: 'J_per_m3', value: '1000' },
      { name: 'q_out', type: 'boundary_condition', units: 'm3_per_s', value: 0 },
    ])
    const library = { ...LIBRARY, availableModules: new Map([['arterial_simple:vp', {}]]) }
    const parameters = parametersOf(await readZip(await generateExportZip('heart', [node], [], library)))
    expect(parameters.u_out_out).toMatchObject({ units: 'J_per_m3', value: '1000', data_reference: 'phlynx' })
    expect(parameters.q_out_out.value).toBe('0')
    expect(notified.warning).not.toHaveBeenCalled()
  })

  it("marks a blank boundary condition for CA to ask for, and warns when nothing is connected to it", async () => {
    const node = nodeWith('out', [{ name: 'u_out', type: 'boundary_condition', units: 'J_per_m3', value: '' }])
    const library = { ...LIBRARY, availableModules: new Map([['arterial_simple:vp', {}]]) }
    const parameters = parametersOf(await readZip(await generateExportZip('heart', [node], [], library)))
    expect(parameters.u_out_out.value).toBe('EMPTY_MUST_BE_FILLED')
    expect(notified.warning).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('out.u_out') }))
  })

  it('writes a constant or global constant of 0, which is not blank', async () => {
    const node = nodeWith('out', [{ name: 'R', type: 'constant', units: 'Js_per_m6', value: 0 }])
    const library = { globalVariables: [['g', { units: 'dimensionless', value: 0 }]], availableModules: new Map([['arterial_simple:vp', {}]]) }
    const parameters = parametersOf(await readZip(await generateExportZip('heart', [node], [], library)))
    expect(parameters.R_out.value).toBe('0')
    expect(parameters.g.value).toBe('0')
  })

  it('writes no obs_data for a workspace without one', async () => {
    expect(Object.keys(await readZip(await generateExportZip('heart', [], [], LIBRARY)))).not.toContain('heart_obs_data.json')
  })
})
