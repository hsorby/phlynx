export type Id = string

export type PortType = 'entrance' | 'exit' | 'general'

export type MultiPort = 'True' | 'Sum' | 'None' | 'Multiply'

export type Access = 'access' | 'no access'

export type VariableType = 'constant' | 'variable' | 'boundary_condition' | 'global_constant'

export interface Parameter {
  variable: string
  value: unknown
  units: string
  reference: unknown
}

export interface Port {
  type: PortType
  label: string
  variables: Variable[]
  multiport: MultiPort
}

export interface Variable {
  name: string
  unit: string
  access: Access
  type: VariableType
}

export type ModuleMetadata = Record<string, unknown>;

export interface MathRef {
  readonly id: Id
}

export interface ModuleRef {
  readonly id: Id
}

