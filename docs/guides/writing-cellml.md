# Writing CellML Guide

PhLynx modules are written in <GlossaryLink term="CellML"/>, a model format that checks units for consistency. You edit them as **CellML Text**, a code-like syntax (`a = b + c;`) that PhLynx converts to CellML XML.

## Opening the Editor

Double-click a node, or click its **Edit instance** (pencil icon) button, to open the Instance Editor. Its left pane has two tabs that edit the same equations:

![CellML text editor](../assets/images/cellml-text-edit.png){.align-center width="600px"}

| Tab | What it does |
| --- | --- |
| **CellML Text** | Text editor with a **Simple Mode** toggle and font-size buttons. The equation preview above it renders the line under the cursor and lists parse errors by line; you can collapse or resize it. |
| **Math Editor** | Build the same equations by typing and clicking. Always in Simple Mode. |

If one tab can't show part of the math, it points you to the other. While the right pane shows the **Plot** tab with **Auto-update** on, clicking a variable in the math plots it. For the rest of the dialog (Parameters, Ports, Plot), see [Interface Overview](../reference/ui-overview.md#instance-editor).

### Simple Mode vs. Advanced Mode

| | Simple Mode (default) | Advanced Mode (Simple Mode off) |
| --- | --- | --- |
| Text holds | Equations only | The whole model: `def model`, `def comp`, `var` lines and equations |
| Variables declared in | The **Parameters** tab, kept in step for you | The text |
| Component name set in | The dialog header | The text (`def comp [name] as`) |

PhLynx remembers which mode you last used. In Simple Mode, if you rename a variable that is still used elsewhere, a notice offers **Rename all** or **Keep both**.

### Saving

- **Save** writes the math back to the component's file and closes the editor; **Apply** saves and keeps it open. PhLynx asks before overwriting an existing component (**Overwrite Math?**).
- If other instances use the same component, tick **Apply math changes to all N instances** to update them too.
- Built-in templates can't be overwritten; PhLynx asks for a new name (**Save As New Component**).

## Units {#units}

PhLynx has a built-in units library, so modules don't need to define their own. In Simple Mode, the Parameters tab's **Units** column suggests library units as you type. To create a unit, type an expression such as `mV/ms` and pick the new unit it offers. For anything else, import a units file; see [CellML Units File](../reference/cellml-units-file.md).

## Writing Equations

Every equation ends with `;`, and both sides must have matching units.

| Kind | Syntax |
| --- | --- |
| Operators | `+`, `-`, `*`, `/` |
| Functions | `sin`, `cos`, `exp`, `sqrt`, `power`, `abs`, `min`, `max`, `ln` (natural log), `log` (base 10) |
| Number with units | `2 {mV}` (no units means dimensionless) |

```bash
// Ohm's law for fluid flow
flow = (u_in - u_out) / R;

// Area from a radius
area = 3.14159 * power(radius, 2);
```

### Ordinary Differential Equations (ODEs)

`ode(variable, VoI)` is the derivative of a variable with respect to the variable of integration (VoI):

```bash
// Rate of change of volume V with respect to t
ode(V, t) = flow_in - flow_out;
```

- The second argument is the VoI, whatever its name (`t`, `time`, `tau`) or units. Simple Mode adds its row to the Parameters tab; in Advanced Mode, declare it yourself (`var t: second;`).
- On export, every module's VoI is connected to one `environment` variable, which takes its name and units from the first ODE's VoI (e.g. `environment/time` in seconds).
- A module without ODEs that needs the VoI, such as a stimulus, can declare `t` or `time` in time units; PhLynx connects it when the units are compatible.

### Algebraic Systems

A model with no ODEs has no VoI and is solved once, so its plots list each variable's value. To see a curve, sweep a parameter; see [Sweep](../reference/simulation-ui-overview.md#sweep). To plot one variable against another, see [Plots](../reference/simulation-ui-overview.md#plots).

```bash
// A lever: the load moved for a given effort
load = effort * arm_ratio;
```

### Conditional Logic (Piecewise)

Use a `sel` block:

```bash
x = sel
    case [condition]: [value_if_true];
    otherwise: [value_if_false];
endsel;
```

```bash
// A valve: flow only from high to low pressure
flow = sel
    case u_in > u_out: (u_in - u_out) / R;
    otherwise: 0 {m3_per_s};
endsel;
```

## Advanced Mode {#advanced-mode}

In Advanced Mode the text is the whole model, wrappers included:

```bash
def model [model_name] as
    def comp [component_name] as
        [variable declarations]
        [equations]
    enddef;
enddef;
```

Declare every variable before you use it:

```bash
var [name]: [units] {init: [value], interface: [public]};
```

```bash
var R: Js_per_m6 {init: 8.5};                     // constant
var u_e: J_per_m3 {init: 150, interface: public};
var flow: m3_per_s;                               // calculated
```

- `init`: starting value. Constants and state variables need one.
- `interface`: CellML visibility, `public` by default. Ports are set in the **Ports** tab, not here.
