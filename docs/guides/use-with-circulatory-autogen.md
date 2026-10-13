# Using PhLynx with Circulatory Autogen

PhLynx was originally designed as a companion application for [Circulatory Autogen](https://physiomelinks.github.io/circulatory_autogen/), a software package for coupling CellML modules and facilitating model calibration, parameter identifiability, and sensitivity analysis.

Existing sets of Circulatory Autogen configuration files can now be imported into PhLynx via the Instance Array Import feature. By default, the Import button is configured to perform a Instance Array import.

## Importing Configuration Files

Click the **Import** button in the Toolbar to open the Import Instance Array dialog.

![Import Instance Array dialog](../assets/images/import-vessel-array.png){.align-center width="550px"}

Select a valid `instance_array.csv` file (see [File Types Guide](../reference/file-types#vessel-array) for reference).

### Handling Missing Definitions

If PhLynx recognizes all module types listed in your array, the workspace will populate immediately.

However, if your array contains module types that are not currently in the PhLynx internal store, you will be prompted to provide the necessary definitions.

1.  **Module Configuration:** You will be asked to upload a `module_config.json` file that matches the modules in your array.
2.  **Source Components:** You may also need to upload the corresponding `.cellml` files referenced in that configuration.

Once all definitions are resolved, PhLynx will generate the graph, recreating your network topology with the correct connections and module types.

## Modifying the Network

Once imported, you can interact with the model using standard PhLynx tools:
* **Visualise:** Inspect connections and layout.
* **Edit:** Add new modules, remove obsolete ones, or re-route connections.
* **Configure:** Update port definitions or module names via the **Edit Module** dialog.

## Exporting Configuration Files

When you are ready to return to Circulatory Autogen, you must export the updated configuration files.

1.  Click the arrow next to the **Export** button in the Toolbar.
2.  Select **Configuration Files**.

### Output

PhLynx will generate and download a `.zip` archive. For an export named `<name>`, it contains:

* `<name>_module_array.csv`: The network topology defining all modules and their connections.
* `<name>_parameters.csv`: The values of constants, boundary conditions and global constants.
* `<name>_obs_data.json`: The workspace's protocol, when it has one.
* A `modules` folder holding:
  * `<name>_module_config.json`: The definitions for ports, variables and units for every module in the workspace.
  * One `*modules.cellml` file per CellML file the modules use, holding the components they use, with any math edited in PhLynx. A file whose name doesn't end in `modules.cellml` is renamed so that Circulatory Autogen finds it, for example `my_math.cellml` becomes `my_math_modules.cellml`. With a heart, the export also writes the components Circulatory Autogen adds around it: `zero_flow`, and the `arterial_simple`/`vp` module it uses for a pulmonary artery and vein when the heart has one output.
  * `<name>_units.cellml`: The units those components use, including units made in PhLynx.

The zip holds everything the model needs. To run it, unzip it and set these in Circulatory Autogen's `user_inputs.yaml`:

```yaml
file_prefix: <name>
resources_dir: <unzipped folder>
input_param_file: <name>_parameters.csv
external_modules_dir: <unzipped folder>/modules
use_builtin_modules: false
```

With the built-in modules on, a component exported from a built-in file would be written twice, and units defined differently in PhLynx would clash. To use the protocol, also set `param_id_obs_path` to `<name>_obs_data.json`.

### Requirements for Successful Export

To ensure the exported files are valid for simulation, ensure the following before exporting:
* At least one module is placed in the workspace.
* All connected modules have their **ports** correctly defined.
* A **Parameter File** has been loaded to correctly categorise variables (constants vs. global constants).
* Every boundary condition with nothing connected to it has a value. PhLynx warns about any that don't, and Circulatory Autogen asks for them (`EMPTY_MUST_BE_FILLED`).
