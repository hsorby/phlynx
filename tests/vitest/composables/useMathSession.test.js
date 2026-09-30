// @vitest-environment happy-dom
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CellMLTextGenerator, CellMLTextParser, applyVariableDefinitions, renameIdentifier } from 'cellml-text-editor'

import { useMathSession } from '../../../src/composables/useMathSession.js'
import { useFlowHistoryStore } from '../../../src/stores/historyStore.js'
import { useLibraryStore } from '../../../src/stores/libraryStore.js'
import { ensureLibCellmlReady } from '../helpers/libcellml-bootstrap.js'

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

const byName = (rows) => Object.fromEntries(rows.map((row) => [row.name, row]))

/** Stands in for CellMLTextEditor: parses text the way it does and reports `change` events. */
function fakeEditor(session) {
  const editor = {
    format: 'cellml-text',
    text: '',
    lastXml: XML,
    report(source, text, simple) {
      const parser = new CellMLTextParser({ simplified: simple })
      const result = parser.parse(text, {
        baseXml: editor.lastXml,
        componentName: 'decay',
        finalise: simple ? (doc) => applyVariableDefinitions(doc, session.editorDefinitions.value) : undefined,
      })
      const valid = result.errors.length === 0 && !!result.xml
      editor.text = text
      if (valid) editor.lastXml = result.xml
      session.handleEditorChange({ source, format: editor.format, text, valid, xml: valid ? result.xml : null })
      return session.flushPendingChanges()
    },
    setText: vi.fn(async (text) => {
      editor.text = text
    }),
    setModel: vi.fn(async () => {}),
    renameVariable: vi.fn((from, to) => editor.report('edit', renameIdentifier(editor.text, from, to), true)),
    flush: () => {},
  }
  return editor
}

describe('useMathSession', () => {
  let session, editorRef, history, ports

  beforeAll(async () => {
    await ensureLibCellmlReady() // isDirty compares models with libcellml
  })

  beforeEach(async () => {
    setActivePinia(createPinia())
    useLibraryStore().addMath(MATH_REF, XML)
    history = useFlowHistoryStore()
    editorRef = ref(null)
    ports = ref([{ label: 'p', variables: ['x', 'k'] }])
    session = useMathSession({ history, editorRef, ports })
    editorRef.value = fakeEditor(session)
    await session.load({ mathRef: MATH_REF, rows: [], managed: true })
  })

  it('builds rows from the cached analysis on open, with units applied', () => {
    const rows = byName(session.parameterRows.value)
    expect(rows.x).toMatchObject({ stateRole: 'state', initialiser: 'x0', units: 'metre' })
    expect(rows.x0.value).toBe('1')
    expect(rows.k).toMatchObject({ value: '0.5', units: 'per_second', type: 'constant' })
    expect(session.parameterRows.value.filter(session.isMissingUnits)).toEqual([])
  })

  it('reports no missing units after the simple-mode editor round-trips the definitions', async () => {
    const simpleText = new CellMLTextGenerator({ simplified: true }).generate(XML)
    await editorRef.value.report('init', simpleText, true)
    expect(session.parameterRows.value.filter(session.isMissingUnits)).toEqual([])
    expect(session.isDirty()).toBe(false)
  })

  it('flags a row whose units are cleared', () => {
    byName(session.parameterRows.value).k.units = ''
    expect(session.parameterRows.value.filter(session.isMissingUnits).map((r) => r.name)).toEqual(['k'])
  })

  it('turns a valid edit into rows and port changes that undo together', async () => {
    const generator = new CellMLTextGenerator({ simplified: true })
    const simpleText = generator.generate(XML)
    await editorRef.value.report('init', simpleText, true)

    const edited = simpleText.replace(/\bk\b/g, 'rate')
    expect(edited).not.toBe(simpleText)
    await editorRef.value.report('edit', edited, true)

    const names = session.parameterRows.value.map((r) => r.name)
    expect(names).toContain('rate')
    expect(names).not.toContain('k')

    await history.undo()
    expect(session.parameterRows.value.map((r) => r.name)).toContain('k')
  })

  describe('when a variable is renamed in the text', () => {
    const SIMPLE_TEXT = 'ode(x, t) = -k * x;\n'

    beforeEach(async () => {
      await editorRef.value.report('init', SIMPLE_TEXT, true)
    })

    it('keeps its units and initialiser, and renames it in ports', async () => {
      await editorRef.value.report('edit', 'ode(y, t) = -k * y;\n', true)

      const rows = byName(session.parameterRows.value)
      expect(rows.y).toMatchObject({ units: 'metre', stateRole: 'state', initialiser: 'x0' })
      expect(rows.x).toBeUndefined()
      expect(rows.y_init).toBeUndefined()
      expect(ports.value[0].variables).toEqual(['y', 'k'])
      expect(session.pendingRename.value).toBeNull()

      await history.undo()
      expect(byName(session.parameterRows.value).x).toMatchObject({ units: 'metre', initialiser: 'x0' })
      expect(ports.value[0].variables).toEqual(['x', 'k'])
    })

    it('follows a name typed a letter at a time', async () => {
      await editorRef.value.report('edit', 'ode(y, t) = -k * y;\n', true)
      await editorRef.value.report('edit', 'ode(ym, t) = -k * ym;\n', true)
      expect(byName(session.parameterRows.value).ym).toMatchObject({ units: 'metre', initialiser: 'x0' })
      expect(ports.value[0].variables).toEqual(['ym', 'k'])
    })

    it('offers to rename the remaining uses, and renames them as one undo step', async () => {
      await editorRef.value.report('edit', 'ode(x, t) = -k * y;\n', true)
      expect(session.pendingRename.value).toEqual({ from: 'x', to: 'y', uses: 1 })
      expect(byName(session.parameterRows.value).y.units).toBe('metre')

      await session.renameEverywhere()
      expect(editorRef.value.renameVariable).toHaveBeenCalledWith('x', 'y')
      expect(editorRef.value.text).toBe('ode(y, t) = -k * y;\n')
      expect(session.pendingRename.value).toBeNull()
      const rows = byName(session.parameterRows.value)
      expect(rows.x).toBeUndefined()
      expect(rows.y).toMatchObject({ units: 'metre', stateRole: 'state', initialiser: 'x0' })
      expect(rows.y_init).toBeUndefined()
      expect(ports.value[0].variables).toEqual(['y', 'k'])

      await history.undo()
      expect(session.parameterRows.value.map((row) => row.name)).toEqual(expect.arrayContaining(['x', 'y']))
      expect(ports.value[0].variables).toEqual(['x', 'k'])
    })

    it('keeps both names when the offer is dismissed', async () => {
      await editorRef.value.report('edit', 'ode(x, t) = -k * y;\n', true)
      session.dismissRename()
      expect(session.pendingRename.value).toBeNull()

      await session.renameEverywhere()
      expect(editorRef.value.renameVariable).not.toHaveBeenCalled()
      expect(ports.value[0].variables).toEqual(['x', 'k'])
    })
  })

  it('rebuilds rows for Advanced Mode, where the text owns initial values', async () => {
    session.isManaged.value = false
    const advancedText = new CellMLTextGenerator({ simplified: false }).generate(XML)
    await editorRef.value.report('external', advancedText, false)

    const rows = byName(session.parameterRows.value)
    expect(rows.k.textInit).toBe('0.5')
    expect(rows.x.stateRole).toBe('state')
  })

  it('keeps the row set (and so row order and focus) when an initialiser is renamed in the table', async () => {
    const simpleText = new CellMLTextGenerator({ simplified: true }).generate(XML)
    await editorRef.value.report('init', simpleText, true)
    const rows = session.parameterRows.value
    const initialiser = rows.find((row) => row.name === 'x0')

    // What ParameterTable.commitRename does.
    initialiser.name = 'x_start'
    rows.find((row) => row.name === 'x').initialiser = 'x_start'
    await editorRef.value.report('external', simpleText, true)

    expect(session.parameterRows.value).toBe(rows)
    expect(session.parameterRows.value.map((row) => row.name)).not.toContain('x0')
    expect(editorRef.value.lastXml).toContain('initial_value="x_start"')
  })

  describe('when an editor mounted after a switch reports init', () => {
    // Reported directly, so each "editor" writes the same math in exactly the way the test needs.
    const report = (source, xml) => {
      session.handleEditorChange({ source, format: 'mathml', text: xml, valid: true, xml })
      return session.flushPendingChanges()
    }
    const reformatted = XML.replace('initial_value="0.5"', 'initial_value="0.50"')

    it('takes the new editor’s version as the baseline if nothing changed', async () => {
      await report('init', XML)
      await report('init', reformatted)
      expect(session.isDirty()).toBe(false)
      expect(session.currentModel.value).toBe(reformatted)
    })

    it('keeps edits made before the switch', async () => {
      await report('init', XML)
      await report('edit', XML.replace('initial_value="0.5"', 'initial_value="0.7"'))
      await report('init', reformatted.replace('initial_value="0.50"', 'initial_value="0.70"'))
      expect(session.isDirty()).toBe(true)
    })
  })

  it('gets square roots from the text editor as <root/>', async () => {
    const withRoot = XML.replace('<apply><minus/><ci>k</ci></apply>', '<apply><root/><ci>k</ci></apply>')
    const simpleText = new CellMLTextGenerator({ simplified: true }).generate(withRoot)
    expect(simpleText).toContain('sqrt(k)')
    await editorRef.value.report('init', simpleText, true)
    expect(session.currentModel.value).toContain('<root/>')
    expect(session.currentModel.value).not.toContain('sqrt')
  })

  it('restores through setModel when the mounted editor writes another format', async () => {
    const simpleText = new CellMLTextGenerator({ simplified: true }).generate(XML)
    await editorRef.value.report('init', simpleText, true)
    const initialXml = session.currentModel.value
    await editorRef.value.report('edit', simpleText.replace(/\bk\b/g, 'rate'), true)

    const mathEditor = { ...fakeEditor(session), format: 'mathml' }
    editorRef.value = mathEditor
    await history.undo()

    expect(mathEditor.setModel).toHaveBeenCalledWith(initialXml)
    expect(mathEditor.setText).not.toHaveBeenCalled()
    expect(session.currentModel.value).toBe(initialXml)
  })

  it('replays an edit that does not parse in the editor that wrote it', async () => {
    const simpleText = new CellMLTextGenerator({ simplified: true }).generate(XML)
    await editorRef.value.report('init', simpleText, true)
    await editorRef.value.report('edit', simpleText + '\nbroken = ;', true)

    await history.undo()
    expect(editorRef.value.setText).toHaveBeenLastCalledWith(simpleText)
    expect(editorRef.value.setModel).not.toHaveBeenCalled()
  })
})
