# Quick Start Guide

We've prepared a simple tutorial to showcase some of PhLynx's capabilities and get you coupling modules of your own. 

## Overview

By the end of this you will:
- Understand the layout of PhLynx
- Learn how to place, connect, and edit modules
- Export your first combined system model

## Workbench layout

Before we get started, it's worth familiarising yourself with PhLynx's <GlossaryLink term="Workbench"/>. There are three main areas for interactions:
- **[Toolbar](./ui-overview#toolbar-top) (top):** A collection of buttons for file management and workspace operations.
- **[Module list](./ui-overview#module-list-left-sidebar) (left):** Storage area for imported <GlossaryLink term="modules"/>.
- **[Workspace](./ui-overview#workbench-centre) (centre):** Working area for assembling your model.

These key areas are highlighted in the image below:
![PhLynx User Interface with workspace and module list highlighted](./assets/images/ca-model-build_ui.png){.align-center width="600px"}

> [!NOTE]
> See [UI overview](./ui-overview) for a more comprehensive description of the user interface and its components.

## Assembling your first model

PhLynx comes pre-installed with a collection of modules that describe a range of physiological processes and subsystems. We'll use some of these to build your first model.

> [!NOTE]
> For creating and importing your own modules, see [Making your own modules](./howto-build-custom-model.md)

### Placing

The Module List contains a text-based search to quickly find the modules you need. To place a module in the <GlossaryLink term="Workspace"/>, simply click on your module of interest and drag it into position.  

For now, find the modules X and Y and drag them onto your Workspace.

[Image of modules X and Y]

### Connecting

With our modules in position, it's time to connect them. You might have noticed that each module in the Workspace contains three buttons.

[Image of module with the buttons highlighted and defined]

From left to right, these are the:
- **[Key](./ui-overview#key):** Colour code the modules for indentifiability (purely visual).
- **[Add port node](./ui-overview#add-port-node):** Add a <GlossaryLink term="port-node"/>.
- **[Edit module](./ui-overview#edit-module):** Open the edit module dialogue.

We'll add some port nodes later. 

### Editing

Before we can couple these modules, we need to provide PhLynx with more information. 

First, click the edit module button to open the [Edit Module](./ui-overview#edit-module) dialogue. 

Here, you'll be able to add and modify <GlossaryLink term="ports"/>, as well as set a custom module name. 

> [!NOTE]
> Module names can also be edited by double clicking on a module placed in the workspace.

Ports can be thought of as a collection of variables that can be shared between connected modules. A port definition has four components:

- **Type:** 
- **Label:**
- **Options:**
- **Sum?:** 
