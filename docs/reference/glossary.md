# Glossary

### Basicport {#basicport}
<!-- aliases: basicports -->
A port that takes only one connection.

### Category {#category}
<!-- aliases: categories, key, keys -->
A user-assigned colour that groups instances. Set it in the Context Sidebar's **Properties** tab.

### CellML {#cellml}
An XML-based markup language for describing mathematical models.

### Circulatory Autogen {#circulatory-autogen}
A Python tool that builds system models from CellML modules and identifies their parameters.

### Connection {#connection}
<!-- aliases: edge, link -->
An arrow between two instances that holds their port couplings.

### Coupling {#coupling}
<!-- aliases: couplings -->
Two ports joined by a connection. See [Port Logic](./valid-port-configurations.md).

### Experiment {#experiment}
<!-- aliases: experiments -->
One run within a protocol, with its own inputs and recorded outputs.

### Ghost Node {#ghost-node}
<!-- aliases: ghost, ghost-nodes -->
A Macro Builder placeholder for an instance in the next copy, used to chain copies. See [Ghost Nodes](./ghost-nodes.md).

### Inspection Module {#inspection-module}
<!-- aliases: inspection-modules -->
A user-created read-out that sums chosen variables with the same units.

### Instance {#instance}
<!-- aliases: instances -->
A module placed in the workspace, with its own name and parameters.

### Instance Array {#instance-array}
A Circulatory Autogen CSV listing each instance, its module type and connected instances.

### Macro {#macro}
<!-- aliases: macros -->
A segment built in the Macro Builder and placed as repeated copies. See the [Macro Builder Guide](../guides/macro-build-guide.md).

### Module {#module}
<!-- aliases: modules -->
A reusable CellML component representing a physiological subsystem.

### Module Configurations {#module-configurations}
A module's boundary condition, exposed ports and variables.

### Module Library {#library}
<!-- aliases: module-list, library, available-modules -->
The panel listing the modules you can place (titled **Available Modules** in the workspace).

### Multiport {#multiport}
<!-- aliases: multiports -->
A port that takes several connections. Each variable is True (shared link), Sum (adds every connection's value) or Multiply (scales by a factor).

### Port {#port}
<!-- aliases: ports, port-option, port-options -->
A labelled set of variables an instance shares with connected instances.

### Port Label {#port-label}
<!-- aliases: port-labels, vessel-type -->
A port's name. Ports couple only when labels match.

### Port Node {#port-node}
<!-- aliases: port-nodes, handle, handles -->
A connection point (handle) on an instance's edge.

### Port Type {#port-type}
<!-- aliases: port-types -->
A port's direction: Input (I), Output (O) or General (G, no direction).

### Protocol {#protocol}
<!-- aliases: protocols, obs_data -->
A sequence of experiments, stored in `obs_data.json`, that set parameters and record outputs.

### SED-ML {#sedml}
An XML format describing how to run and plot a simulation, exportable with the CellML model.

### Sweep {#sweep}
<!-- aliases: sweeps, parameter sweep -->
A simulation repeated over a range of one parameter's values; an optional second "family" parameter draws one curve per value.

### Tracked Run {#tracked-run}
<!-- aliases: tracked runs, track -->
A run whose lines stay on the charts, dashed, for comparison with later runs.

### VoI {#voi}
<!-- aliases: variable of integration -->
The variable of integration a model is solved over; time is one possible VoI.

### Workspace {#workspace}
<!-- aliases: workbench -->
The canvas where you place and connect instances; saved as a workspace JSON file.
