# Simulating Your Model

PhLynx can run and plot your model in-app, without exporting to another tool. This guide walks through the Simulation panel, available in three places:

* The **Simulation** tab in the Context Sidebar (right edge of the Workbench) — runs the whole model or just the selected instances.
* The **Plot** tab of the [Instance Editor](../reference/ui-overview.md#instance-editor) — a single temporary plot for the instance you're editing, driven by clicking variables in its math.
* The full-page **`/simulation`** view — opened with the toolbar's "Open page" button, for a larger, whole-model-only layout with chart downloads.

All three share the same controls; see the [Simulation UI Reference](../reference/simulation-ui-overview.md) for an exhaustive list.

## Running a Simulation

1. Open the Simulation tab (or the Plot tab, or the `/simulation` page).
2. In the sidebar or Plot tab, choose a scope: **Whole model**, or select one or more instances on the canvas first and switch to **Selection**. The `/simulation` page always runs the whole model.
3. Press **Play**. A progress bar shows while it runs; press **Stop** to cancel.
4. Once finished, pick variables to plot from the controls below the chart — or adjust a slider to see the effect immediately.

> [!NOTE]
> Cutting a Sum/Multiply port's inputs when simulating a selection drops them with a warning rather than blocking the run. A boundary condition with no supplier and no value is set to 0, with a warning, for the run only — a whole-model CellML/OMEX export still reports it as missing.

## Plotting a Variable from the Math Editor

In the Instance Editor's Plot tab, you can plot a variable without leaving the equations:

1. Switch the left pane to the **Math Editor** tab (see [Writing CellML](./writing-cellml.md)).
2. Make sure **Auto-update** is on (toggle beside the Plot tab's toolbar).
3. Click any variable rendered in the math — including a single-letter name or one buried in a denominator.

The Plot tab replaces its single plot with that variable and reruns if needed. Clicking a variable not yet saved shows a brief "Save to plot X" notice; clicking one that's set rather than computed (e.g. a boundary condition) explains that it isn't plotted. Turn Auto-update off to add more than one variable to the Plot tab's chart, offered only in units matching what's already plotted.

This Plot tab's chart is temporary — it's never written to the workspace's saved plot configuration.

## Tracking Runs

To compare values without losing your current results, click **Track** in the toolbar. This pins the current run's lines onto the charts, dashed, while you keep adjusting sliders. Each tracked run can be renamed, hidden, or removed from the run list; the live run itself can also be hidden to compare tracked runs alone. See [Tracked Runs](../reference/simulation-ui-overview.md#tracked-runs) for limits.

## Protocols and Sweeps

Besides a plain time course, Play can instead run:

* A **protocol** of experiments, if one is loaded — see [Running Protocols](./running-protocols.md).
* A **sweep** over one parameter (optionally drawing one curve per value of a second parameter) — see [Sweep Editor](../reference/simulation-ui-overview.md#sweep-editor) and the [Algebraic Systems](./writing-cellml.md#algebraic-systems) section of the CellML guide.

The toolbar's Protocol/Sweep buttons appear once either is configured, and switch what Play runs.

## Zooming and Comparing Charts

Drag across a chart to zoom in; double-click it to zoom back out. Charts in the same panel zoom together; hold **Shift** while dragging or double-clicking to zoom one chart alone.

## Exporting Results

* **CSV** and **PNG** buttons download the plotted data or the charts as shown.
* **SED-ML** downloads a zip with the run plan and the CellML model — the protocol's run if one is active, otherwise the time course/steady-state run. This is disabled while a sweep is selected; switch back to the time course to export.

## Floating Viewer and the Full Page

From the sidebar's toolbar, the **Float** button opens a small results window over the canvas and collapses the sidebar, so you can keep building while watching results. The **Open page** button instead navigates to the full `/simulation` view, with larger charts and a resizable controls panel; pressing **F9** there also runs the current mode.
