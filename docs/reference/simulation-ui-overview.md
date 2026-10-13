# Simulation UI Reference

This page details the controls of the **Simulation panel** — the shared workbench used in the Context Sidebar's Simulation tab, the Instance Editor's Plot tab, and the full-page `/simulation` view. For a task-oriented walkthrough, see [Simulating Your Model](../guides/simulating-your-model.md).

## Toolbar

| Control | Icon | Purpose |
| :--- | :--- | :--- |
| **Play / Stop** | Triangle / Square | Runs or stops the simulation. Its tooltip names what will run, e.g. "Simulate the whole model" or "Simulate the selection (3)". |
| **Scope switch** | `pi-sitemap` / `pi-box` | Toggles between **Whole model** and **Selection**. Not shown on the `/simulation` page, which always runs the whole model. |
| **Protocol** | `pi-list-check` | Shown only when a protocol (`obs_data.json`) is loaded. Switches Play to run the protocol's experiments instead of a time course. |
| **Sweep** | `pi-chart-line` | Shown only when a sweep is configured (Simulation Settings → Sweep). Switches Play to run the sweep. |
| **Track** | `pi-bookmark` | Keeps the current run's lines on the charts, dashed, while you try other values. See [Tracked Runs](#tracked-runs). |
| **Float** | `pi-window-minimize` | Opens a small floating results window over the canvas, collapsing the sidebar to give the canvas room. |
| **Open page** | `pi-external-link` | Navigates to the full-page `/simulation` view (available from the sidebar and Instance Editor, not on the page itself). |
| **Edit obs_data** | `pi-pen-to-square` | Opens the protocol editor. See [Running Protocols](../guides/running-protocols.md). |
| **Settings** | `pi-cog` | Opens Simulation Settings on its Parameters tab (Plot Setup and Parameter Scan). |

Play, Protocol and Sweep are mutually exclusive: only one determines what pressing Play runs at a time. On the full `/simulation` page, pressing **F9** also runs the current mode.

## Plots

- **One unit per plot.** A plot only accepts variables sharing its units; adding a variable in different units creates a new plot.
- **Synced chart groups.** Time-course charts in the same panel share the widest left/right gutters among them, so their plotting areas line up despite differently-sized y-axis labels.
- **Zoom.** Drag across a chart to zoom in; double-click it to zoom back out. This zooms every chart in its sync group together. Hold **Shift** while dragging or double-clicking to zoom that one chart alone.
- A chart's zoom persists by its own key, so it survives reopening the floating viewer.

## Sweep Editor

Configure a sweep from Simulation Settings → Sweep, or the sidebar's parameter-scan editor:

- **From / To / Points:** the swept range and its number of samples (2 to 1000 points).
- **Family (optional):** draws one curve per value of a second parameter. Enter its values in the **"Values separated by commas"** field — commas, spaces, or semicolons all work (up to 8 values).
- **Reading of each time course** (ODE models only): each run is reduced to one of four readouts — **End** (the steady-state value), **Min**, **Max**, or **Peak** (the value furthest from zero, keeping its sign). Default is End.
- A cost estimate ("51 × 3 = 153 time courses, about 12 s") warns once a sweep exceeds 200 runs, and is capped at 2000 runs total.
- Sweeps can't be exported as SED-ML — switch back to the time course first. Web OpenCOR also can't run a sweep; an OMEX export instead solves the model once, at the parameter's own value.

## Tracked Runs

Track the current run from the toolbar to keep its lines on the charts (dashed) while you try other slider values:

- Each tracked run can be renamed inline, shown/hidden, or removed individually, or all removed at once.
- The live run itself can also be hidden, to compare tracked runs alone.
- Up to a fixed maximum of tracked runs are kept at a time (older ones must be removed to track more).
- Each run records the slider and global-constant values it used, shown as its detail line.

## Exports

- **CSV:** every plotted series, at full precision.
- **PNG:** the charts as shown, composed into one image (not available for a steady-state/algebraic run, which has no chart).
- **SED-ML:** a zip of the run plan plus the CellML model — either the protocol's run, or the time course/steady-state run. Disabled while a sweep is active (see above).
