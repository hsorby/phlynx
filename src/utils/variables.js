export function isEditableVariableType(variableType) {
  // A variable is editable if it has a defined value and is not marked as read-only
  return variableType !== 'variable' && variableType !== 'boundary_condition'
}
