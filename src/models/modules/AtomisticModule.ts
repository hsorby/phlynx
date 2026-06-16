import { Module } from "./Module";
import { MathRef, Port, Variable, Id, ModuleMetadata } from "../types";

export class AtomicModule extends Module {
  private readonly mathRef: MathRef
  private readonly ports: Port[];
  private readonly variables: Variable[];

  constructor(
    id: Id,
    name: string,
    mathRef: MathRef,
    ports: Port[],
    variables: Variable[] = [],
    metadata: ModuleMetadata = {}
  ) {
    super(id, name, metadata)
    this.mathRef = mathRef
    this.ports = ports
    this.variables = variables
  }

  getPorts(): Port[] {
    return this.ports
  }

  getVariables(): Variable[] {
    return this.variables
  }

  getMathRef(): string {
    return this.mathRef.id
  }
}
