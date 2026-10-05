// @vitest-environment happy-dom
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFlowHistoryStore } from '../../../src/stores/historyStore.js'
import { useLibraryStore } from '../../../src/stores/libraryStore.js'
import { ensureLibCellmlReady } from '../helpers/libcellml-bootstrap.js'

vi.mock('../../../src/composables/useConfirmDialog', () => ({ useConfirmDialog: () => ({ confirm: vi.fn() }) }))
vi.mock('@vue-flow/core', async (importOriginal) => ({
  ...(await importOriginal()),
  useVueFlow: () => ({ nodes: ref([]) }),
}))
vi.mock('../../../src/utils/layout', () => ({ waitUntilStable: () => Promise.resolve() }))

const { default: InstanceEditorDialog } = await import('../../../src/components/InstanceEditorDialog.vue')

const MATH_REF = 'file:decay'
const XML = `<model xmlns="http://www.cellml.org/cellml/2.0#" name="decay">
  <component name="decay">
    <variable name="t" units="second" interface="public_and_private"/>
    <variable name="x" units="metre" initial_value="x0"/>
    <variable name="x0" units="metre" initial_value="1"/>
    <variable name="k" units="per_second" initial_value="0.5"/>
    <math xmlns="http://www.w3.org/1998/Math/MathML">
      <apply><eq/>
        <apply><diff/><bvar><ci>t</ci></bvar><ci>x</ci></apply>
        <apply><times/><apply><minus/><ci>k</ci></apply><ci>x</ci></apply>
      </apply>
    </math>
  </component>
</model>`
const EDITED_XML = XML.replace('<apply><minus/><ci>k</ci></apply>', '<apply><minus/><cn>1</cn></apply>')

const setText = vi.fn()
const setModel = vi.fn()

/** Stands in for CellMLTextEditor: the test emits its events and watches what the session asks of it. */
const FakeEditor = defineComponent({
  emits: ['change', 'undo', 'redo'],
  setup(_, { expose }) {
    expose({ format: 'mathml', setText, setModel, flush: () => {}, getErrors: () => [], focus: () => {} })
    return () => h('div')
  },
})

const DialogStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', [slots.header?.(), slots.default?.(), slots.footer?.()])
  },
})

let wrapper
afterEach(() => wrapper?.unmount())

/**
 * Mounts the dialog closed, with the editors stubbed.
 *
 * @returns {import('@vue/test-utils').VueWrapper}
 */
function mountDialog() {
  wrapper = mount(InstanceEditorDialog, {
    props: { modelValue: false, id: 'a', initialName: 'a', mathRef: MATH_REF },
    global: {
      plugins: [PrimeVue],
      stubs: { Dialog: DialogStub, CellMLTextEditor: FakeEditor, MathWorkbenchEditor: FakeEditor, ParameterTable: true },
    },
  })
  return wrapper
}

/**
 * Opens the dialog and waits for its editor to mount.
 *
 * @returns {Promise<import('@vue/test-utils').VueWrapper>} The editor.
 */
async function open() {
  await wrapper.setProps({ modelValue: true })
  await vi.waitFor(() => expect(wrapper.findComponent(FakeEditor).exists()).toBe(true))
  return wrapper.findComponent(FakeEditor)
}

/**
 * Reports a change from the editor and waits for the session to record it.
 *
 * @param {import('@vue/test-utils').VueWrapper} editor
 * @param {'init'|'edit'} source
 * @param {string} xml
 */
async function report(editor, source, xml) {
  editor.vm.$emit('change', { source, format: 'mathml', text: xml, valid: true, xml })
  await flushPromises()
}

describe('InstanceEditorDialog undo (#605)', () => {
  beforeAll(async () => {
    await ensureLibCellmlReady()
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useLibraryStore().addMath(MATH_REF, XML)
  })

  it('does not undo canvas actions', async () => {
    const canvasCommand = { undo: vi.fn(), redo: vi.fn() }
    await useFlowHistoryStore().executeAndAddCommand(canvasCommand)
    mountDialog()
    const editor = await open()
    await report(editor, 'init', XML)
    await report(editor, 'edit', EDITED_XML)

    editor.vm.$emit('undo')
    editor.vm.$emit('undo')
    await flushPromises()
    expect(canvasCommand.undo).not.toHaveBeenCalled()
    expect(useFlowHistoryStore().canUndo).toBe(true)
  })

  it('does not replay an earlier open’s edits', async () => {
    mountDialog()
    let editor = await open()
    await report(editor, 'init', XML)
    await report(editor, 'edit', EDITED_XML)
    await wrapper.setProps({ modelValue: false })

    editor = await open()
    await report(editor, 'init', XML)
    vi.clearAllMocks()
    editor.vm.$emit('undo')
    await flushPromises()
    expect(setModel).not.toHaveBeenCalled()
    expect(setText).not.toHaveBeenCalled()
  })
})
