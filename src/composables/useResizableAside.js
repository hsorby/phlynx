import { ref, onUnmounted } from 'vue'

/**
 * @param {number} initialWidth
 * @param {number} min
 * @param {number} max
 * @param {'left' | 'right'} anchor
 */
export function useResizableAside(initialWidth = 250, min = 200, max = 500, anchor = 'left') {
  const width = ref(initialWidth)

  const onResizing = (event) => {
    event.preventDefault()
    // Calculate new width based on mouse X position
    // Math.max/min clamps the value between your defined limits
    const rawWidth = anchor === 'right' ? window.innerWidth - event.clientX : event.clientX
    width.value = Math.max(min, Math.min(rawWidth, max))
  }

  const stopResize = () => {
    window.removeEventListener('mousemove', onResizing)
    window.removeEventListener('mouseup', stopResize)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  const startResize = (event) => {
    event.preventDefault()
    
    // Optional: Change cursor globally so it doesn't flicker back to pointer
    // if you drag too fast outside the handle
    document.body.style.cursor = 'col-resize' 
    document.body.style.userSelect = 'none'

    window.addEventListener('mousemove', onResizing)
    window.addEventListener('mouseup', stopResize)
  }

  // Safety cleanup: ensure listeners are removed if component is destroyed while dragging
  onUnmounted(() => {
    stopResize()
  })

  return {
    width,
    startResize
  }
}
