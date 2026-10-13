# Welcome to PhLynx

Physiome Links (**PhLynx**, pronounced "flinks") is a web app for coupling existing <GlossaryLink term="CellML"/> components into system models, such as coupled cell models and blood or lymph flow networks.

New here? Start with the [Quick Start Guide](./quick-start-guide.md).

## Why PhLynx?

- **Visual assembly:** connect modules on a canvas instead of writing variable mappings by hand.
- **Reusable modules:** combine open library modules with your own.
- **Standard output:** models are valid CellML, so units are checked and CellML tools can turn them into code (e.g. C, Python).
- **Open source:** free to use, audit and extend ([GitHub](https://github.com/physiomelinks/phlynx)).

## Workflow

1. **Create or acquire** CellML components in your editor of choice, or download existing ones.
2. **Import** them into PhLynx (CellML files, COMBINE archives or Circulatory Autogen models).
3. **Assemble** the model by connecting modules and defining their ports.
4. **Simulate** in the app: plot results, adjust parameters with sliders, compare runs, and run protocols and sweeps.
5. **Export or send** the model as flattened CellML, an OMEX archive for [OpenCOR](https://opencor.ws/) or CUFLynx, or [Circulatory Autogen](https://physiomelinks.github.io/circulatory_autogen/) files for calibration and sensitivity analysis.
