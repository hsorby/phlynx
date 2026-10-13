# Simulation UI Reference

Every Simulation panel control. For a walkthrough, see [Simulating Your Model](../guides/simulating-your-model.md).

## Toolbar {#toolbar}

| Button (tooltip) | Purpose |
| :--- | :--- |
| **Play / Stop** (triangle / square) | Runs or stops (F9). The tooltip says what runs, e.g. **Simulate the whole model**. A dot means results are out of date. |
| Scope switch | **Whole model** or **Selection** (sidebar) / **This instance** (Plot tab). |
| **Run the protocol's experiments** (checklist icon) | Shown when a protocol is loaded. See [Running Protocols](../guides/running-protocols.md). |
| **Run the sweep** (chart-line icon) | Shown when a sweep is set. |
| **Track this run** (bookmark icon) | See [Tracked Runs](#tracked-runs). |
| **Float over the canvas** (window icon) | Sidebar only. Opens the [floating viewer](#floating-viewer). |
| **Open the simulation page** (external-link icon) | Sidebar only. |
| **Edit obs_data** (pen-to-square icon) | Opens the protocol editor. |
| **Simulation settings** (cog icon) | Opens [Simulation Settings](#simulation-settings) on Solver. |

The protocol and sweep buttons switch what Play runs, and run it.

## Controls {#controls}

Views: **Plots**, **Sliders**, **Sweep**, **Runs**. Search matches every typed word in an `instance/variable` path.

### Plots {#plots}

- Search to add a variable to the chosen plot. A plot holds one unit; other units go to a matching or new plot.
- **Add plot**; ⋯ menu: **Rename**, **Move up**, **Move down**, **Remove plot**.
- **Phase plots:** ⋯ ▸ **Plot against a variable…**; **Plot against time** returns to the VoI, whatever it is.
- **Zoom:** drag in, double-click out. Charts zoom together; hold Shift for one.

### Sliders {#sliders}

- **Add slider**. Moving one reruns the model.
- ⋯ menu: **Back to the model's value**, **Apply this value to the model**, **Edit range…**, **Remove slider**.
- **swept** marks the swept parameter. Sliders are off during a protocol.

### Sweep {#sweep}

**Sweep a parameter**: a constant, global constant, or boundary condition nothing supplies. Results plot against it.

- **From / To / Points:** 2 to 1000 points.
- ⋯ ▸ **Add a curve for each value of…** a second parameter (up to 8 values; 2000 runs max). ⋯ also has **Change parameter…** and **Stop sweeping**.
- **Reading** of each time course (ODE models): **End** (default), **Min**, **Max** or **Peak** (the value furthest from 0).
- Shows the run count and a time estimate; warns above 200 time courses.
- The SED-ML download is off while sweeping. Other exports run the model once, at the parameter's own value.

### Tracked Runs {#tracked-runs}

- Up to 5. Not for protocol runs or sweeps with curves. Cleared when the run type changes (time course, steady state, another sweep).
- In **Runs**: rename, hide or remove runs; hide the live run.

## Simulation Page {#simulation-page}

![The /simulation page](../assets/images/simulation-page.png){.align-center width="800px"}

- Runs the whole model; **Workspace** goes back.
- **Time course / Protocol / Sweep** sets what Play runs.
- The controls panel resizes and collapses. Its folding **Simulation settings** section holds **Starts at**, **Plots start at**, **Ends at**, **Point interval** and **Solver**.

## Floating Viewer {#floating-viewer}

One plot at a time (picker, or **New plot**), with **Edit this plot's variables**, scope, Play/Stop, **Sliders**, **Track this run** and **Back to the Simulation tab**.

## Simulation Settings {#simulation-settings}

From the cog or the main toolbar's **Configure simulation settings**. Tabs: **Plots**, **Sliders & sweep**, **Solver**. Web OpenCOR doesn’t support a later **Plots start at**, so an export may not match.

## Downloads {#downloads}

Only on the simulation page:

- **CSV:** every plotted series.
- **PNG:** the charts as one image (not for steady state).
- **SED-ML:** zip of the run, its plots and the CellML model. When disabled, its tooltip says why.
