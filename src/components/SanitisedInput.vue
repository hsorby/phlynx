<template>
  <div ref="rootRef" class="sanitised-input" :style="{ width }">
    <InputText
      ref="inputRef"
      :id="inputId || undefined"
      :autofocus="autofocus"
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :invalid="invalid"
      size="small"
      class="sanitised-input__field"
      :class="{
        'sanitised-input__field--warning': unsanitary,
        'sanitised-input__field--notice': showNotice,
      }"
      :style="fontSize ? { fontSize } : undefined"
      @update:model-value="emit('update:modelValue', $event ?? '')"
      @blur="commit"
      @keydown.enter="commit"
      @keydown.esc="emit('revert', $event)"
    />

    <!-- Non-blocking warning, shown inside the field so it never shifts the layout -->
    <i v-if="showNotice" class="pi pi-exclamation-triangle sanitised-input__notice" :title="notice"></i>

    <!-- `floating` lifts the popover out of the page flow, so a scrolling table can't clip it -->
    <Teleport to="body" :disabled="!floating">
      <Transition name="sanitised-pop">
        <div
          v-if="unsanitary"
          class="sanitised-input__popover"
          :class="{ 'sanitised-input__popover--floating': floating }"
          :style="floating ? floatingStyle : undefined"
          role="alert"
        >
          <div class="sanitised-input__arrow"></div>
          <i class="pi pi-exclamation-triangle sanitised-input__icon"></i>
          <span v-if="cleaned">
            Will be renamed to <strong>{{ cleaned }}</strong>
          </span>
          <span v-else-if="fallback">
            Not a valid name. Will revert to <strong>{{ fallback }}</strong>
          </span>
          <span v-else>Not a valid name</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import InputText from 'primevue/inputtext'

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** (raw) => cleaned. Return '' when nothing valid is left. */
  sanitise: { type: Function, default: (value) => value },
  /** Used on blur when the cleaned value is empty. */
  fallback: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  width: { type: String, default: '100%' },
  /** Overrides the input's font size (e.g. '1rem'); otherwise the surrounding style applies. */
  fontSize: { type: String, default: '' },
  /** Anchor the popover to the viewport instead of the field. Use inside scrolling containers. */
  floating: { type: Boolean, default: false },
  /** A warning that doesn't change the value (e.g. "not in the library"). Shown as an icon in the field. */
  notice: { type: String, default: '' },
  /** Shows the field as failing validation (e.g. a rejected save). */
  invalid: { type: Boolean, default: false },
  /** The input's id, so a `<label for>` can point at it. */
  inputId: { type: String, default: '' },
  /** Focuses the input when it mounts (e.g. a dialog's first field). */
  autofocus: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'commit', 'revert'])

const rootRef = ref(null)
const inputRef = ref(null)

const cleaned = computed(() => props.sanitise(props.modelValue ?? ''))
const unsanitary = computed(() => !props.disabled && (props.modelValue ?? '') !== cleaned.value)
// The rename popover is the more important message, so it takes over from the notice.
const showNotice = computed(() => !!props.notice && !unsanitary.value)

// Fix the value when the user leaves the field, so typing is never interrupted.
function commit() {
  if (props.disabled) return
  const next = cleaned.value || props.fallback
  if (next !== props.modelValue) emit('update:modelValue', next)
  emit('commit', next)
}

// ── Floating placement ───────────────────────────────────────────────────────
const floatingStyle = ref({})

/** Re-anchors the floating popover to the field. */
function updatePosition() {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect) return
  floatingStyle.value = { top: `${rect.bottom + 8}px`, left: `${rect.left}px` }
}

function trackPosition(active) {
  const method = active ? 'addEventListener' : 'removeEventListener'
  // Capture, so scrolling any ancestor (the table body, the dialog) moves the popover with the field.
  window[method]('scroll', updatePosition, true)
  window[method]('resize', updatePosition)
}

watch(
  () => props.floating && unsanitary.value,
  async (active) => {
    trackPosition(active)
    if (active) {
      await nextTick()
      updatePosition()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => trackPosition(false))

/** Moves focus to the field. */
function focus() {
  inputRef.value?.$el?.focus()
}

defineExpose({ focus, updatePosition })
</script>

<style scoped>
.sanitised-input {
  position: relative;
  display: inline-block;
  flex: 0 1 auto;
  min-width: 0;
}

.sanitised-input__field {
  width: 100%;
}

.sanitised-input__field--warning {
  border-color: var(--p-yellow-500, #eab308);
}

.sanitised-input__field--notice {
  padding-right: 1.9rem;
}

.sanitised-input__notice {
  position: absolute;
  top: 50%;
  right: 0.6rem;
  transform: translateY(-50%);
  font-size: 0.8rem;
  color: var(--p-yellow-600, #ca8a04);
  cursor: help;
}

.sanitised-input__popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--p-yellow-500, #eab308) 45%, var(--p-content-border-color));
  border-radius: 6px;
  background: color-mix(in srgb, var(--p-yellow-500, #eab308) 14%, var(--p-content-background));
  color: var(--p-text-color);
  font-size: 0.8125rem;
  font-weight: normal;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

/* Positioned by script from the field's bounding box; sits above the modal dialog. */
.sanitised-input__popover--floating {
  position: fixed;
  z-index: 4000;
}

.sanitised-input__arrow {
  position: absolute;
  top: -5px;
  left: 14px;
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
  border-top: 1px solid color-mix(in srgb, var(--p-yellow-500, #eab308) 45%, var(--p-content-border-color));
  border-left: 1px solid color-mix(in srgb, var(--p-yellow-500, #eab308) 45%, var(--p-content-border-color));
  background: color-mix(in srgb, var(--p-yellow-500, #eab308) 14%, var(--p-content-background));
}

.sanitised-input__icon {
  font-size: 0.8rem;
  color: var(--p-yellow-500, #eab308);
}

.sanitised-pop-enter-active,
.sanitised-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sanitised-pop-enter-from,
.sanitised-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .sanitised-pop-enter-active,
  .sanitised-pop-leave-active {
    transition: none;
  }
}
</style>
