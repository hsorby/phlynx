# User Interface


This page provides a comprehensive reference for all user interface elements in PhLynx. 

## Main Interface Layout

### Module List (Left Sidebar)

The module list displays all CellML components that have been imported into PhLynx and are available for use in your workspace.

**Features:**
- **Collapsible sections:** Click on module names to expand/collapse groups of components from the same CellML file
- **Drag and drop:** Click and drag any module from the list into the workspace area to add it to your model
- **Visual identification:** Module names are displayed exactly as they appear in the CellML file

**Interactions**
- Single-click a module name to select it
- Click and drag to add module to workspace
- Scroll to view all available modules

---

### Workbench (Centre)

The main working area where you assemble your model by placing modules and creating connections.

**Interactions**
- **Pan:** Click and drag on empty space to move around the workspace
- **Zoom:** Use mouse wheel or trackpad to zoom in/out
- **Select modules:** Click on a module to select it (see Selection Tools below)
- **Draw connections:** Click and drag from one port node to another

#### Control bar (Lower Left)

A collection of buttons to perform the following quick actions (top to bottom):
- Zoom in
- Zoom out
- Zoom to fit
- Lock workspace
- Screenshot 

---

### Toolbar (Top)

The toolbar contains buttons for file management and workspace operations. 

#### Load Modules

Imports CellML files containing modules to be used in your model.

**Action:** Opens a file dialog to select one or more .cellml files from your computer

**Supported formats:** .cellml files

**Result:** All components in the selected file(s) are added to the Module List

#### Load Parameters

Imports a parameter file to identify constants and global constants.  (Marked for Deprecation)

**Action:** Opens a file dialog to select a .csv parameter file

**Required format:** Circulatory Autogen parameter file format (see [File Specifications](./reference-file-type.md))

**Result:** Parameters are loaded and used during export to properly categorize variables.

**Important:** Parameter names must follow Circulatory Autogen naming conventions:
- Constants: [module_name]_[parameter_name]
- Global constants: [parameter_name]

#### Load Workspace

Loads a previously saved PhLynx workspace.

**Action:** Opens a file dialog to select a .json workspace file

**Result:** The workspace is restored to its saved state, including:
- Module positions
- Port definitions
- Connections between modules
- Module names and keys (colors)

#### Save Workspace

Saves the current workspace to a JSON file.

**Action:** Downloads a .json file representing the current workspace state
**File location:** Your browser's configured download folder (typically Downloads)
**Contents:** Complete workspace configuration for later restoration

#### Import

Import using a vessel array file or json file.

#### Export 

Export Circulatory Autogen configuration files or a flattened CellML file.

**Action:** Downloads a ZIP archive containing:

- vessel_array.csv - Defines connections between modules
- module_config.json - Defines parameters and ports for each module

**Requirements before export:**
- At least one module placed in workspace
- Parameter file loaded (for proper variable categorization)
- Ports defined for connected modules

**File location:** Your browser's configured download folder

> [!NOTE]
> When using Chrome, you will be prompted to select the save location at the time of export.


- **Module List (Left)**: Collapsible list of available CellML modules that can be dragged and dropped into the workspace area.
- **Workspace Area**: The main area for users to place modules, draw connections, and edit ports (shared variables)
- **File Management Buttons**: (Upper-right-hand side) Buttons for importing CellML files, loading parameters, saving/loading workspaces, and exporting CA configuration files.

## Core Elements & Interactions


###### Module Node

Each module node represents a CellML module that has been imported and placed into the workspace area.
The module node displays an editable module name (equivalent to the vessel_name in Circulatory Autogen) and the CellML component and file of origin.
Users can drag and drop these nodes onto the workspace area from the module list.
Each module node contains three icons that enable users to edit the colour (key), add port nodes, and edit the module configuration.

![Labelled module node](./assets/images/module-elements.png){.align-center width="600px"}

###### Key

The key icon on each module node allows users to assign a colour to the module for visual identification.
Clicking the key icon opens a colour selection menu with preset colours and labels.

![Expanded Key menu](./assets/images/key.png){.align-center width="600px"}

###### Add Port Node

The pin icon on each module node allows users to add port nodes, which are nodes that enable users to draw arrows between modules to indicate the existence of shared parameters.
Clicking the pin icon adds a new port node to the module either on the top, left, right, or bottom of the selected module node.

![Expanded Add Port Node menu](./assets/images/add-port-node.png){.align-center width="600px"}

###### Edit Module

The pencil icon on each module node opens a dialogue that allows users to edit the module name and create ports by selecting variables from the CellML module.
Port names are manually editable and variables are selectable from a dropdown list populated with variables from the CellML module.

![Expanded Add Port Node menu](./assets/images/edit-module-detail.png){.align-center width="600px"}

> [!NOTE]
> Module name (vessel_name) can also be edited by double-clicking on a module node in the Workspace Area view.

###### Selecting Multiple Modules

Users can select multiple modules by holding down the Control (or Command on Mac) key and clicking on the desired modules.
Alternatively, users can hold the Shift key to click and drag to easily select multiple modules.
Once selected, users can move or delete selected modules as a group.

Module Node Controls
Each module node in the workspace has three interactive icons for configuration and management.
Key Icon (Color Selector)
Location: Left icon on module node
Purpose: Assigns a color to the module for visual organization and identification
Action: Click to open color selection menu
Options:

Predefined color palette with labels
Colors are purely for visual identification
No effect on exported model functionality

Use case: Group related modules by color (e.g., all cardiac modules in red, all renal modules in blue)

Pin Icon (Add Port Node)
Location: Center icon on module node
Purpose: Adds port nodes to the module for creating connections
Action: Click to reveal directional menu, then click desired position
Options:

Top
Right
Bottom
Left

Result: A new port node appears at the selected position on the module
Multiple ports: You can add multiple port nodes to the same module, in any configuration

Pencil Icon (Edit Module)
Location: Right icon on module node
Purpose: Opens the Edit Module dialog for configuring module properties
Action: Click to open dialog
Configurable properties:

Module name (vessel_name)
Port definitions (port name and associated variables)


Edit Module Dialog
The Edit Module dialog allows detailed configuration of module properties.
Module Name Field
Purpose: Sets the module's name as it will appear in exported configuration files (equivalent to vessel_name in Circulatory Autogen)
Interactions:

Type directly into the text field
Press Enter or click outside to save
Also editable by double-clicking the module name in the workspace

Requirements:

Must match naming used in parameter file
Should be descriptive and unique


Port Definition Section
Purpose: Maps CellML variables to ports that can be shared between modules
Components:
Port Name Field

User-assigned name for the shared variable
Think of this as the "common language" name used across modules
Can be edited freely

Variable Dropdown

Lists all variables available in the CellML module
Select the variable(s) to expose through this port
Multiple variables can be selected for a single port

Add Port Button

Adds a new port definition row
Each port can have its own name and variable selection

Delete Port Button

Removes a port definition
Appears next to each port row

Best practice: Port names should clearly indicate what the shared variable represents (e.g., "sodium_concentration", "membrane_voltage")

Dialog Controls
Save Button: Applies changes and closes dialog
Cancel Button: Discards changes and closes dialog

Port Node Controls
Port nodes are the connection points on modules where arrows can be drawn.
Port Node Display
Visual elements:

Small circular node on module edge
Position determined when created (top/right/bottom/left)
Highlights on hover


Port Node Actions
Creating Connections
Action: Click and drag from one port node to another
Visual feedback:

Arrow follows cursor while dragging
Valid drop targets highlight
Arrow snaps to target when released

Result: Creates a directed connection (arrow) indicating shared variables

Deleting Port Nodes
Action: Hover over port node and click the trash icon that appears
Result: Port node and any connected arrows are removed
Warning: Deleting a port node removes all connections to/from that node

Connection Arrows
Arrows represent shared variables between modules.
Arrow Properties
Direction: Indicates the flow of information (if directional)
Visual style:

Solid line
Arrowhead points to destination module


Arrow Interactions
Delete connection: Click on the arrow and press Delete key, or right-click and select delete (if context menu available)
Multiple connections: Multiple arrows can connect to the same port node

Selection Tools
Single Selection
Action: Click on a module node
Result: Module is selected (highlighted)
Use: Move, delete, or edit individual modules

Multi-Selection (Click)
Action: Hold Ctrl (Windows/Linux) or Cmd (Mac) and click multiple modules
Result: All clicked modules are selected
Use: Perform actions on multiple modules simultaneously

Multi-Selection (Drag)
Action: Hold Shift and click-drag to create a selection box
Result: All modules within the box are selected
Use: Quickly select groups of modules

Moving Selected Modules
Action: Click and drag any selected module
Result: All selected modules move together, maintaining their relative positions

Deleting Selected Modules
Action: Press Delete or Backspace key while modules are selected
Result: All selected modules and their connections are removed

Keyboard Shortcuts
ActionShortcutDelete selected modulesDelete or BackspaceMulti-select modulesCtrl + Click (Windows/Linux)Cmd + Click (Mac)Box select modulesShift + DragRename moduleDouble-click module nameSave changes in Edit dialogEnter

Visual Feedback
Hover States

Port nodes highlight when hovering
Delete icons appear when hovering over port nodes
Connection arrows highlight when hovering


Selection States

Selected modules have highlighted borders
Selected modules can be moved as a group


Connection Drawing

Temporary arrow follows cursor during drag
Valid drop targets are highlighted
Connection snaps into place when released