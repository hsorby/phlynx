import { SOURCE_HANDLE_TYPE, TARGET_HANDLE_TYPE } from "../../utils/constants"

function parseInstanceNames(connectedInstances) {
  return Array.from(
    new Set(connectedInstances?.trim().split(/\s+/).filter(Boolean) ?? [])
  )
}

function buildHandles(instance) {
  const handles = []

  if (instance.inp_instances) {
    const inputs = parseInstanceNames(instance.inp_instances)
    inputs.forEach((name) => {
      handles.push({
        uid: crypto.randomUUID(),
        type: TARGET_HANDLE_TYPE,
        side: 'left',
        name,
      })
    })
  }

  if (instance.out_instances) {
    const outputs = parseInstanceNames(instance.out_instances)
    outputs.forEach((name) => {
      handles.push({
        uid: crypto.randomUUID(),
        type: SOURCE_HANDLE_TYPE,
        side: 'right',
        name,
      })
    })
  }

  return handles
}

function buildPorts(moduleData) {
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
          multiportType: p.multi_port ?? 'None',
        }))
    )
}

export { buildPorts, buildHandles }
