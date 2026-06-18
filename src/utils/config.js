import { portTypeOptions } from "./constants"

export function normaliseConfig(config) {
  return {
    id: `${config.module_type}:${config.module_subtype}`,
    mathRef: `${config.component_file}:${config.component_type}`,
    ports: normalisePorts(config),
    variables: normaliseVariables(config.variables_and_units),
  }
}

function normalisePorts(config) {
  const ports = []

  for (const [configKey, portType] of Object.entries(portTypeOptions)) {
    const list = config[configKey] || []
    for (const p of list) {
      ports.push({
        port_type: portType,
        label: p.port_type,
        variables: p.variables || [],
        multiport_type: parseMultiport(p.multi_port),
      })
    }
  }

  return ports
}

function normaliseVariables(list = []) {
  return list.map(([name, unit, access, type]) => ({
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