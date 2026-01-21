# FAQs & Troubleshooting

A collection of common questions and solutions for PhLynx issues.

## Frequently Asked Questions

### Where does PhLynx save exported files?
As a web-based application, PhLynx downloads files to your browser's default download location (typically your OS `Downloads` folder).

> [!TIP]
> **Chrome Users:** You can configure your browser settings to "Ask where to save each file before downloading" if you prefer to choose a specific location for every export.

---

## Troubleshooting

### Import Issues

#### "Vessel Array Import Failed"
**Symptoms:** The workspace remains empty or an error notification appears after selecting a file.
**Solution:**
* **Check Delimiters:** Ensure your `.csv` uses commas (`,`) as delimiters, not semicolons or tabs.
* **Verify Headers:** The file must contain these exact column headers: `vessel_name`, `BC_type`, `vessel_type`, `inp_vessels`, `out_vessels`.
* **Unknown Types:** If your array references a `vessel_type` not in the library, ensure you provide the corresponding `module_config.json` and `.cellml` files when prompted.

#### "Parameter File Error"
**Symptoms:** Constants are not being recognized during export.
**Solution:**
* Verify the naming convention: Constants must follow `[module_name]_[parameter_name]`.
* Ensure the file is a valid `.csv` with all required columns.

### Export Issues

#### "Export button is disabled"
**Cause:**
* The workspace is empty.
* You are currently in the **Macro Builder** view. You must return to the main workspace to export the full system.

### Connection Issues

#### "I cannot connect two ports"
**Cause:**
* **Label Mismatch:** Connections can only be made between ports with identical Labels (e.g., `voltage` to `voltage`).
* **Type Incompatibility:** You cannot connect Input-to-Input or Output-to-Output. See [Valid Port Configurations](../reference/valid-port-configurations) for details.