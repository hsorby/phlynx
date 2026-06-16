import type {
  Id,
  Port,
  Variable,
  ModuleMetadata,
} from '../types'

export abstract class Module {
  readonly id: Id
  name: string
  metadata: ModuleMetadata

  protected constructor(id: Id, name: string, metadata: ModuleMetadata = {}) {
    this.id = id
    this.name = name
    this.metadata = metadata
  }

  abstract getPorts(): Port[]
  abstract getVariables(): Variable[]
  abstract getMathRef(): string
}

