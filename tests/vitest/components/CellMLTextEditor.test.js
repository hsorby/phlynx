// @vitest-environment happy-dom
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, describe, expect, it } from 'vitest'

import CellMLTextEditor from '../../../src/components/CellMLTextEditor.vue'

const modelWith = (rightHandSide) => `<model xmlns="http://www.cellml.org/cellml/2.0#" name="m">
  <component name="c">
    <variable name="x" units="metre"/>
    <variable name="y" units="metre"/>
    <math xmlns="http://www.w3.org/1998/Math/MathML">
      <apply><eq/><ci>y</ci>${rightHandSide}</apply>
    </math>
  </component>
</model>`

const DEFINITIONS = [
  { name: 'x', units: 'metre' },
  { name: 'y', units: 'metre' },
]

let wrapper
afterEach(() => wrapper?.unmount())

/** Mounts the editor in Simple Mode and waits for its `init` report. */
async function mountEditor(xml) {
  wrapper = mount(CellMLTextEditor, {
    props: { modelValue: xml, simple: true, componentName: 'c', variableDefinitions: DEFINITIONS },
    global: { plugins: [PrimeVue] },
    attachTo: document.body,
  })
  await nextTick()
  await nextTick()
  return wrapper
}

const changes = () => (wrapper.emitted('change') ?? []).map(([change]) => change)
const isEditable = () => wrapper.find('.cm-content').attributes('contenteditable') === 'true'

describe('CellMLTextEditor', () => {
  it('edits math the text can hold', async () => {
    await mountEditor(modelWith('<apply><root/><ci>x</ci></apply>'))
    expect(isEditable()).toBe(true)
    expect(wrapper.vm.getErrors()).toEqual([])
    expect(changes()[0]).toMatchObject({ source: 'init', valid: true })
    expect(changes()[0].xml).toContain('<root/>')
  })

  it('locks the text when it cannot hold all the math', async () => {
    await mountEditor(modelWith('<apply><factorial/><ci>x</ci></apply>'))
    expect(isEditable()).toBe(false)

    const [lead, ...details] = wrapper.vm.getErrors()
    expect(lead.message).toContain('Use the Math Editor tab')
    expect(details.map((err) => err.message)).toEqual(['<factorial> is not supported in CellML Text'])
    expect(wrapper.find('.error-banner').text()).toContain('<factorial> is not supported in CellML Text')

    // The marked text doesn't parse, so nothing is reported as a valid model or as an edit.
    expect(changes().map(({ source, valid }) => ({ source, valid }))).toEqual([{ source: 'init', valid: false }])
  })
})
