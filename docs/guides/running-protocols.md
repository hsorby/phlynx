# Running Protocols

A **protocol** is a set of experiments that set parameters and record outputs. It is stored as `obs_data.json`. A workspace has one protocol, either imported with a COMBINE archive or created with **Edit obs_data**.

## Editing a Protocol

Click **Edit obs_data** (pen-to-square icon) in the Simulation toolbar. The editor has **Undo**/**Redo** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z), a problem count and **Save**/**Cancel**. Data items are read-only, so edit them in CUFLynx.

## Running a Protocol

1. Click **Run the protocol's experiments** (checklist icon). Click it again to go back to the time course.
2. Choose an experiment, or **All experiments** to overlay them.
3. Turn on **Inputs** to plot the values the protocol set.

![Protocol results](../assets/images/protocol-results.png){.align-center width="800px"}

The obs_data plots compare observed and calculated values, followed by any **Prediction plots**. Sliders are off while a protocol runs.

## Sliders from `params_for_id.csv`

Each matching row of an imported archive's `params_for_id.csv` becomes a slider, and COMBINE archive exports write the sliders back. See [Supported File Formats](../reference/file-types.md#params_for_idcsv).
