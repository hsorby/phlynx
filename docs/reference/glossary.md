# Glossary

### Module {#module}
<!-- aliases: modules -->
A reusable component representing a physiological subsystem.

### Port Node {#port-node}
<!-- aliases: port-nodes, node -->
A connection point on a module.

### Port {#port}
<!-- aliases: ports -->
An exposed variable or collection of variables that can be shared between connected modules.

### Port Label {#port-label}
<!-- aliases: port-labels, vessel-type -->
User-assigned name for a variable or collection of variables.

### Port Option {#port-option}
<!-- aliases: port-options -->
A variable (or variables) associated with a given port.

### Key {#key}
<!-- aliases: keys -->
User-assigned colour to indicate module category. 

### Port Type {#port-type}
<!-- aliases: port-types -->
Indicates directionality of a port. Can be input, output, or general (directionless).

### Module List {#module-list}
<!-- aliases: -->
Collection of modules available for placement in workbench. 

### Library {#library}
<!-- aliases: Library -->
Collection of modules available for placement in workbench. 

### Workbench {#workbench}
<!-- aliases: -->
Working area for coupling modules.

### Workspace {#workspace}
<!-- aliases: -->
A workbench populated with modules.

### Connection {#connection}
<!-- aliases: edge, link -->
An arrow that traverses two port nodes in the workbench.

### Instance Array {#instance-array}
<!-- aliases: -->
A circulatory autogen configuration file that describes the connections between modules and the configurations to be used.

### Module Configurations {#module-configurations}
<!-- aliases: -->
A description of a module, boundary condition, exposed ports, and its variables.

### CellML {#cellml}
<!-- aliases: -->
An XML-based markup language for describing mathematical models.

### Circulatory Autogen {#circulatory-autogen}
<!-- aliases: -->
A Python project for combining CellML modules into a system model and performing parameter identification.

### Protocol {#protocol}
<!-- aliases: protocols, obs_data -->
A sequence of experiments, stored in an `obs_data.json` file, that set parameters and record outputs against a model.

### Experiment {#experiment}
<!-- aliases: experiments -->
One run within a protocol, with its own inputs and recorded outputs.

### Sweep {#sweep}
<!-- aliases: sweeps, parameter sweep -->
A simulation run repeatedly across a range of one parameter's values, optionally with a second "family" parameter drawing one curve per value.

### Tracked Run {#tracked-run}
<!-- aliases: tracked runs, track -->
A simulation run whose lines are pinned to the charts, dashed, so later runs can be compared against it.

### Multiport {#multiport}
<!-- aliases: multiports -->
A port that accepts more than one connection. Each connected variable is set to True (a plain shared link), Sum (adds every connection's value), or Multiply (scales a connection's value by a factor).

### SED-ML {#sedml}
<!-- aliases: -->
An XML format describing how to run and plot a simulation experiment, exportable from PhLynx alongside its CellML model.
