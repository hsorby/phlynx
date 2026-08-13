import { defineStore } from 'pinia'
import { ref } from 'vue'

import { BASELINE_SIMULATION_SETTINGS } from '../utils/constants'

function cloneSimulationSettings(settings = {}) {
  return {
    ...BASELINE_SIMULATION_SETTINGS,
    ...(settings || {}),
  }
}

function clonePlainObject(value) {
  if (!value || typeof value !== 'object') return {}
  return JSON.parse(JSON.stringify(value))
}

export const useSimSettingsStore = defineStore('simSettings', () => {
  const simulationSettings = ref(cloneSimulationSettings())
  const plotConfig = ref({})
  const parameterScanConfig = ref({})

  function resetStore() {
    simulationSettings.value = cloneSimulationSettings()
    plotConfig.value = {}
    parameterScanConfig.value = {}
  }

  function setSimulationSettings(nextSettings) {
    simulationSettings.value = cloneSimulationSettings(nextSettings)
  }

  function setPlotConfig(nextPlotConfig) {
    plotConfig.value = clonePlainObject(nextPlotConfig)
  }

  function setParameterScanConfig(nextParameterScanConfig) {
    parameterScanConfig.value = clonePlainObject(nextParameterScanConfig)
  }

  function loadState(state) {
    if (!state) {
      resetStore()
      return
    }

    setSimulationSettings(state.simulationSettings)
    setPlotConfig(state.plotConfig)
    setParameterScanConfig(state.parameterScanConfig)
  }

  function getState() {
    return {
      simulationSettings: cloneSimulationSettings(simulationSettings.value),
      plotConfig: clonePlainObject(plotConfig.value),
      parameterScanConfig: clonePlainObject(parameterScanConfig.value),
    }
  }

  return {
    simulationSettings,
    plotConfig,
    parameterScanConfig,
    resetStore,
    setSimulationSettings,
    setPlotConfig,
    setParameterScanConfig,
    loadState,
    getState,
  }
})
