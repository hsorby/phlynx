import { SOURCE_PORT_TYPE, TARGET_PORT_TYPE } from "../../utils/constants"

function parseModuleNames(moduleField) {
  return Array.from(
    new Set(moduleField?.trim().split(/\s+/).filter(Boolean) ?? [])
  )
}

function buildPorts(module) {
  const ports = []

  if (module.inp_modules) {
    const inputs = parseModuleNames(module.inp_modules)
    inputs.forEach((name) => {
      ports.push({
        uid: crypto.randomUUID(),
        type: TARGET_PORT_TYPE,
        side: 'left',
        name,
      })
    })
  }

  if (module.out_modules) {
    const outputs = parseModuleNames(module.out_modules)
    outputs.forEach((name) => {
      ports.push({
        uid: crypto.randomUUID(),
        type: SOURCE_PORT_TYPE,
        side: 'right',
        name,
      })
    })
  }

  return ports
}

function buildPortLabels(moduleData) {
  return Object.entries(moduleData)
    .filter(
      ([key, value]) =>
        ['general_ports', 'entrance_ports', 'exit_ports'].includes(key) &&
        Array.isArray(value)
    )
    .flatMap(([type, ports]) =>
      ports
        .filter((p) => p.port_type && p.variables?.length)
        .map((p) => ({
          portType: type,
          label: p.port_type,
          variables: p.variables.flat(),
          multiport: p.multi_port ?? 'None',
        }))
    )
}

export { buildPortLabels, buildPorts }
