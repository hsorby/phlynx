import { PORT_TYPE_OPTIONS } from "./constants"

export function normaliseConfig(config) {
  return {
    moduleRef: `${config.module_type}:${config.module_subtype}`,
    mathRef: `${config.component_file}:${config.component_type}`,
    ports: normalisePorts(config),
    variables: normaliseVariables(config.variables_and_units),
  }
}

function normalisePorts(config) {
  const ports = []

  // SMELL - option.value isn't the most intuitive thing to read
  PORT_TYPE_OPTIONS.forEach((option) => {
    const list = config?.[option.value] || []
    for (const p of list) {
      ports.push({
        port_type: option.value,
        label: p.port_type, // SMELL - holdover from strange naming in circulatory autogen
        variables: p.variables || [],
        multiport_type: parseMultiport(p.multi_port),
      })
    }
  })
  return ports
}

function normaliseVariables(RawVariablesAndUnits = []) {
  return RawVariablesAndUnits.map(([name, unit, access, type]) => ({
    name,
    unit,
    access,
    type,
  }))
}

function parseMultiport(value) {
  if (value === true || value === "True") return "True"
  if (value === "Sum") return "Sum"
  if (value === "Multiply") return "Multiply"
  return "None"
}