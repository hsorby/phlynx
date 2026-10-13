# Using Custom Modules

Use your own CellML modules alongside the built-in ones.

1. **Write the module.** Either drag the **new_module** template from the <GlossaryLink term="module-list"/> and write its equations in the Instance Editor (see [Writing CellML](./writing-cellml.md)), or write a `.cellml` file in another tool (see [CellML Module Format](../reference/cellml-module-format.md)).
2. **Import the file.** Use Import ▸ **CellML File**, or drop one or more `.cellml` files on the Workspace. Components appear in Available Modules, and any `<units>` join the units library ([CellML Units File](../reference/cellml-units-file.md)).
3. **Optionally import values.** Use Import ▸ **Parameters** (`.csv`) to fill in parameter values; see [Supported File Formats](../reference/file-types.md#parameter-file). Set each variable's type in the Instance Editor's Parameters tab.

Custom modules then work like library modules: place, connect and export them as usual.
