# CellML Units File

PhLynx doesn't have a separate "Import Units" menu item — units are imported from the same `.cellml` file as modules, via **Import → CellML File**. This page describes what that file needs to contribute units.

## Requirements

- The file must be valid CellML XML and parse without errors, as for [CellML Module Format](./cellml-module-format.md).
- It must define one or more named `<units>` elements in its `<model>`. There's no further structural requirement beyond being valid CellML unit definitions — the component(s) in the same file are irrelevant to this step.

## What Gets Imported

- Every named `<units>` definition in the file is added to PhLynx's units library, available to any module.
- If the same file also has components, they're imported as modules at the same time — see [CellML Module Format](./cellml-module-format.md).

## Usage

A units-only file — one whose components you never intend to place — is still worth importing if it defines units your other modules need. PhLynx centralises the most common biological units internally, so this is mainly useful for project-specific or uncommon units.

> [!TIP]
> If a unit is simply a known expression of existing units (e.g. `mV/ms`), the Parameters tab's units-suggestion box can generate it for you without importing a separate file — see [Writing CellML](../guides/writing-cellml.md).
