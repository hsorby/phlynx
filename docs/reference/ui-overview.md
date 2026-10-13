# Interface Overview

The top nav switches between **Workspace**, **Simulation** ([simulation page](./simulation-ui-overview.md#simulation-page)), **User Guide** and **About**. The Workspace view has four areas: the **[Toolbar](#toolbar)** (top), **[Available Modules](#module-library)** (left, your <GlossaryLink term="modules"/>), the **[Workspace canvas](#workspace)** (centre) and the **[Context Sidebar](#context-sidebar)** (right).

![PhLynx Workspace view with the toolbar, Available Modules, canvas and Context Sidebar](../assets/images/phlynx_ui.png){.align-center width="800px"}

For shortcuts, see [Keyboard Shortcuts](./keyboard-shortcuts.md).

---

## Toolbar {#toolbar}

![The main toolbar](../assets/images/toolbar.png){.align-center width="800px"}

| Button (tooltip) | Icon | What it does |
| :--- | :--- | :--- |
| **Load workspace** | Folder | Opens a saved `.json` [workspace file](./file-types.md#workspace-file). |
| **Save workspace** | Disk | Saves to `.json`, including simulation settings (Ctrl/Cmd+S). |
| **Clean up workspace** | Dustpan | Auto-arranges the instances. |
| **Clear workspace** | Eraser | Removes everything from the canvas (undoable). |
| **Undo** / **Redo** | Arrows | Edit history. |
| **Add left / top / right / bottom handle** | Box with a dot on that side | Adds a port on that side of the selected instances. |
| **Open macro builder** | Hammer | Opens the [Macro Builder](../guides/macro-build-guide.md). |
| **Configure simulation settings** | Chart with cog | Opens [Simulation Settings](./simulation-ui-overview.md#simulation-settings). |
| **Settings** | Cog | Opens app [Settings](#settings). |
| **Import** / **Export** / **Send** | Split buttons | Click runs the last-used item (Ctrl/Cmd+I, Ctrl/Cmd+E); the arrow opens the menu. |

On the right are **Report Issue** and a light/dark switch. Where supported (e.g. Chrome), saving and exporting ask where to put the file.

### Import {#import}

| Menu item | File | Result |
| :--- | :--- | :--- |
| **Instance Array** | `.csv` | Builds a connected model from an [instance array](./file-types.md#instance-array), asking for any missing module files. |
| **CellML File** | `.cellml` | Adds its components to Available Modules and its [units](./cellml-units-file.md) to the units library. |
| **Module Config** | `.json` | Loads [module configurations](./file-types.md#module-configuration). |
| **Parameters** | `.csv` | Fills parameter values from a [parameter file](./file-types.md#parameter-file). |
| **COMBINE Archive** | `.omex` | Restores a model with any protocol or [`params_for_id.csv`](./file-types.md#params_for_idcsv). |

You can also drop `.cellml` or `.omex` files onto the canvas ([Opening files](./file-types.md#opening-files)).

### Export and Send {#export}

| Menu item | Output |
| :--- | :--- |
| **CellML** (default) | Flattened CellML 2.0 model, with a link to open it in OpenCOR. |
| **Circulatory Autogen** | `.zip` of CA input files; see [Using PhLynx with Circulatory Autogen](../guides/use-with-circulatory-autogen.md#export). |
| **OpenCOR** | `.omex` with plots, settings and any parameter scan, with a link to open it in Web OpenCOR. |
| **CUFLynx** | `.omex` for CUFLynx. |
| **CellML (selection)** / **OpenCOR (selection)** | The same, for the selected instances only; warns if the selection is incomplete. |

**Send** (paper-plane icon) opens the model, or the selection, straight in Web OpenCOR without saving a file.

---

## Available Modules {#module-library}

Modules are grouped by source file. **Search Library…** filters them; drag a card onto the canvas to place an instance.

* Each card has a module picker, a config picker when there are several, **Preview configuration** (eye icon) and **Remove module** (cross icon).
* **Hide module library** (chevron) collapses the panel; drag its edge to resize.

---

## Workspace canvas {#workspace}

| Action | How |
| :--- | :--- |
| Pan / zoom | Drag empty canvas / scroll wheel or pinch |
| Select | Click; Ctrl+click (Cmd+click on Mac) adds; Shift+drag draws a box |
| Rename an instance | Click its name |
| Open the Instance Editor | Double-click an instance, or click **Edit instance** (pencil icon) |
| Right-click the canvas | **Create Module**, **Select All**, **Fit View**, **Clear Workspace** |
| Right-click an instance | **Replace Module**, **Simulate Instance** (or **Simulate Selection (N)**) |

**Search** (`Type / to search`, top of the canvas): find instances by name, or prefix `var:` to find them by variable. Enter / Shift+Enter steps through matches.

**Controls** (bottom-left): zoom, fit view, lock, and **Export image** (picture icon), which saves the view as PNG or SVG ([Settings](#settings)). A minimap sits bottom-right.

---

## Instance nodes {#module-nodes}

![An instance node](../assets/images/module-elements.png){.align-center width="400px"}

Each node shows its name, component (box icon), source file (file icon) and **Edit instance** (pencil icon). A warning triangle means a parameter has no value.

---

## Connections {#connections}

* **Add a port:** hover a node's edge and drag from the green ghost handle, or use the toolbar's **Add … handle** buttons.
* **Connect:** drag from one port to another. The arrow's direction is used in instance array exports.
* **Edit couplings:** double-click an arrow to open the [Connections dialog](./valid-port-configurations.md#connections-dialog).
* **Delete:** select an arrow and press Delete or Backspace. Hover a port and click its trash icon to remove it and its arrows.

---

## Instance Editor {#instance-editor}

The header holds the **Instance** name (unique), the **Component** name and the source file.

![Instance Editor on the Ports tab](../assets/images/edit-module-detail.png){.align-center width="800px"}

* **Left pane:** **CellML Text** or **Math Editor**, two views of the same equations; see [Writing CellML](../guides/writing-cellml.md).
* **Right pane:** **Parameters**, **Ports** and **Plot** tabs (collapsible, resizable).
* **Footer:** **Cancel**, **Apply** (save and keep editing) and **Save** (Ctrl/Cmd+Enter). **Apply math changes to all N instances** also updates instances sharing the component.

### Port definitions {#port-definitions}

Each row on the **Ports** tab exposes variables through a port; hover the dot by the label to see what it connects to.

| Column | Meaning |
| :--- | :--- |
| **Type** | G, I or O; see [port types](./valid-port-configurations.md#port-types). |
| **Label** | Shared name; ports couple when labels match. |
| **Mode** | Toggles **Basicport** (one connection) and **Multiport** (several). |
| **Variables** | The variables the port exposes. On a multiport, click a variable's chip to cycle **True**, **Sum** and **Multiply** (with a factor). |

**Add port** adds a row; the trash icon removes one.

---

## Context Sidebar {#context-sidebar}

**Hide context panel** (chevron) collapses it to its icons; click an icon to reopen that tab.

| Tab | Icon | Shows |
| :--- | :--- | :--- |
| **Global parameters** | Globe | Global constants (searchable, editable) |
| **Instance parameters** | Sliders | The selected instance's parameters (one instance at a time) |
| **Inspection modules** | Question mark | Read-outs of chosen variables |
| **Properties** | Wrench | Node colour theme; click a category to colour the selection |
| **Simulation** | Chart | Run and plot; see [Simulation UI Reference](./simulation-ui-overview.md) |

---

## Settings {#settings}

Opened with **Settings** (cog icon).

| Section | Settings |
| :--- | :--- |
| Units | **Units suggestion format**: CellML built-in or SI base units |
| Simulation | **Plot inspection modules**; **Show data items** (in Edit obs_data) |
| Image export | **Image format** (PNG or SVG); **Include warning symbols** |
