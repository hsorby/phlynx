# Port Logic

Ports determine how data flows between connected modules. Each port must be assigned a specific type—**Input**, **Output**, or **General**—which dictates its compatibility with other ports in the system.

## Connection Logic

During model export, PhLynx connects variables between modules only if two conditions are met:
1.  **Matching Labels:** The connected ports share the exact same port label.
2.  **Compatible Types:** The port types form a valid pair as defined below.

## Compatibility Table

The following table outlines valid connections between port types:

| Port Type | Connects With |
| :--- | :--- |
| **Input** | Output, General |
| **Output** | Input, General |
| **General** | Input, Output, General |

> [!NOTE]
> **Circulatory Autogen Users:** "Input" and "Output" port types are equivalent to "Entrance" and "Exit" port types respectively in [Circulatory Autogen](https://github.com/physiomelinks/circulatory_autogen).

## Incompatible Connections

If two connected ports share a label but have incompatible types (e.g., Input to Input), **the connection will be ignored** during model export.

> [!IMPORTANT]
> Currently, PhLynx does not generate a warning or error message for incompatible connections. Ensure your port types are configured correctly before exporting to avoid missing connections in your final model.