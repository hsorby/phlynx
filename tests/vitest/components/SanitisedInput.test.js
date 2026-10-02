// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, describe, expect, it } from 'vitest'

import SanitisedInput from '../../../src/components/SanitisedInput.vue'

let wrapper
afterEach(() => wrapper?.unmount())

describe('SanitisedInput', () => {
  it('puts the id and autofocus on the input, so a label and a dialog can find it', () => {
    wrapper = mount(SanitisedInput, {
      props: { modelValue: 'name', inputId: 'module-name', autofocus: true },
      global: { plugins: [PrimeVue] },
    })
    const input = wrapper.find('input')
    expect(input.attributes('id')).toBe('module-name')
    expect(input.attributes()).toHaveProperty('autofocus')
  })

  it('exposes updatePosition for callers that move the field', () => {
    wrapper = mount(SanitisedInput, { props: { modelValue: 'x', floating: true }, global: { plugins: [PrimeVue] } })
    expect(typeof wrapper.vm.updatePosition).toBe('function')
  })
})
