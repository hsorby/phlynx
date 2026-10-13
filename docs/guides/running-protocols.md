# Running Protocols

A **protocol** is a sequence of experiments that set parameters and record outputs against your model — stored as an `obs_data.json` file alongside it. PhLynx can load, edit, and run one protocol per workspace from the Simulation panel.

> [!NOTE]
> PhLynx supports a single protocol per workspace, sourced from one `obs_data.json` file found in the model's COMBINE/OMEX archive.

## Editing a Protocol

Click the **Edit obs_data** button (pencil-and-paper icon) in the Simulation toolbar to open the protocol editor. PhLynx wraps the editor with:

- **Undo / Redo** (`Cmd`/`Ctrl` + `Z`, `Shift` + `Cmd`/`Ctrl` + `Z`), disabled when there's nothing to undo or redo.
- A footer count of data items, and — if any rows are invalid — a count of problems stopping it from running.
- **Save** (enabled once you've made changes) and **Cancel**. Closing with unsaved changes asks you to confirm discarding them.

The rows, stack, and legend editing itself is provided by the `@physiomelinks/protocol-kit` package embedded in this dialog — refer to its own documentation for the details of building experiments, inputs, and traces.

## Running a Protocol

Once a protocol is loaded, a **Protocol** button appears in the Simulation toolbar. Click it to switch Play from a plain time course to running the protocol's experiments.

- If the protocol defines more than one experiment, a picker above the results lets you choose which one to show, or select **All experiments** to overlay every experiment's results on the same charts for comparison.
- An **Inputs** toggle shows or hides the values the protocol set, plotted alongside the results.

## Parameter Sweeps via `params_for_id.csv`

CUFLynx/circulatory_autogen workflows often define a parameter scan in a `params_for_id.csv` file (columns `vessel_name,param_name,param_type,min,max,name_for_plotting`). PhLynx reads this file automatically from an imported COMBINE/OMEX archive and turns each row into a slider in the **Parameter Scan** tab of Simulation Settings — `vessel_name` is `global` for a global constant, or the instance name otherwise. Exporting a COMBINE archive writes these sliders back out the same way, generating a fresh `params_for_id.csv` if the model didn't already have one.

See [Supported File Formats](../reference/file-types.md#params_for_idcsv) for the file's exact columns.
