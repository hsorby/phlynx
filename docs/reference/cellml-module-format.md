# CellML Module Format

This page describes what a `.cellml` file needs for PhLynx to import its components as modules, via **Import → CellML File**.

## Requirements

- The file must be valid <GlossaryLink term="CellML"/> XML (it is rejected before parsing if it doesn't use the CellML namespace).
- It must parse without errors under PhLynx's CellML 2.0 parser.
- It must define a `<model>` containing one or more `<component>` elements. Each component in the file becomes one module in the **Module List**, available to drag onto the Workspace.

## What Gets Imported

- Every component's name, variables, and equations.
- Any `<units>` the same file defines are imported too, in the same step — see [CellML Units File](./cellml-units-file.md). A file can usefully contain both modules and companion units, or units alone.

## Notes

- A component's internal variables aren't exposed as ports until you add them in the [Instance Editor's Ports tab](./ui-overview.md#port-definitions) after placing the module.
- If a unit a component relies on isn't in PhLynx's built-in library or the imported file, the Parameters tab flags it as missing — import a file that defines it, or pick a different unit.
