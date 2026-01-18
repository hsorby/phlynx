
# Welcome to PhLynx


Physiome Links (**PhLynx** - pronounced "flinks") is a web-based graphical interface for coupling existing <GlossaryLink term="CellML"/> modules into a single system model. Common use cases include generating coupled biophysical cell models and patient-specific blood and/or lymph flow networks.

## Why PhLynx?


PhLynx streamlines the model-building workflow by providing:

- **Visual Model Assembly:** Instead of manually mapping variables between <GlossaryLink term="CellML"/> components, you can graphically connect modules, define shared variables, and visualise your system architecture.

- **Module Reusability:** This software promotes reusability and easy coupling of <GlossaryLink term="CellML"/> modules. Access a wide range of openly available modules and easily couple them with whatever modules you develop. Instead of creating one monolithic model that is unlikely to be reused, you can integrate modular components into system models that others can build upon.

- **The Benefits of CellML:** By generating models in <GlossaryLink term="CellML"/>, you can regenerate your model in whatever language you need (C++, Python, MATLAB). This enables easy coupling with other model types (PDEs), C generation for embedded systems, and much more. Consistency in units is also guaranteed.

- **Open Source Code:** PhLynx is completely open source, promoting reproducible science by encouraging anyone to use and check the modules or models that are created.


## How PhLynx Fits Into Your Workflow


PhLynx works as part of the <GlossaryLink term="CellML"/> ecosystem to facilitate model composition. After creating <GlossaryLink term="CellML"/> modules in your preferred IDE, or downloading existing <GlossaryLink term="CellML"/> modules, import the <GlossaryLink term="CellML"/> files into PhLynx. Here, you can connect modules and export a flattened <GlossaryLink term="CellML"/> model for simulation in [OpenCOR](https://opencor.ws/) or for calibration, parameter identifiability, and sensitivity analysis in [Circulatory Autogen](https://physiomelinks.github.io/circulatory_autogen/).
