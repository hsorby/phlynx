import { ref, onUnmounted } from 'vue'

export function useConnectionAutoscroll(canvasEl) {
  const draggingFrom = ref(null)
  let connectScrollRaf = null
  const mousePos = { x: 0, y: 0 }
  
  // A toggle to bypass Vue Flow's identical-coordinate optimization cache
  let jitterToggle = false 
  
  const CONNECT_AUTOSCROLL_ZONE = 60
  const CONNECT_AUTOSCROLL_SPEED = 12

  function onConnectMouseMove(event) {
    // Only capture real user mouse movements, ignore our synthetic events
    if (event.isTrusted) {
      mousePos.x = event.clientX
      mousePos.y = event.clientY
    }
  }

  function startConnectAutoScroll() {
    if (connectScrollRaf) return
    window.addEventListener('mousemove', onConnectMouseMove)

    function tick() {
      if (!draggingFrom.value) { stopConnectAutoScroll(); return }
      const el = canvasEl.value
      if (!el) { connectScrollRaf = null; return }

      const rect = el.getBoundingClientRect()
      const vy = mousePos.y - rect.top
      const canvasH = el.clientHeight
      const maxScroll = el.scrollHeight - canvasH
      
      let scrolled = false

      // Scroll Up
      if (vy < CONNECT_AUTOSCROLL_ZONE && el.scrollTop > 0) {
        const speed = CONNECT_AUTOSCROLL_SPEED * (1 - Math.max(0, vy) / CONNECT_AUTOSCROLL_ZONE)
        el.scrollTop = Math.max(0, el.scrollTop - speed)
        scrolled = true
      } 
      // Scroll Down
      else if (vy > canvasH - CONNECT_AUTOSCROLL_ZONE && el.scrollTop < maxScroll) {
        const speed = CONNECT_AUTOSCROLL_SPEED * (1 - (canvasH - vy) / CONNECT_AUTOSCROLL_ZONE)
        el.scrollTop = Math.min(maxScroll, el.scrollTop + speed)
        scrolled = true
      }

      if (scrolled) {
        // Toggle jitter between +0.1 and -0.1 to force Vue Flow to recalculate 
        // the coordinate projection against the new scrollTop position.
        jitterToggle = !jitterToggle
        const jitter = jitterToggle ? 0.1 : -0.1

        const eventOpts = {
          clientX: mousePos.x + jitter,
          clientY: mousePos.y + jitter,
          bubbles: true,
          cancelable: true,
          view: window
        }
        
        // Vue Flow attaches its drag listeners to the window.
        // Dispatching both ensures compatibility across Vue Flow versions.
        window.dispatchEvent(new PointerEvent('pointermove', eventOpts))
        window.dispatchEvent(new MouseEvent('mousemove', eventOpts))
      }

      connectScrollRaf = requestAnimationFrame(tick)
    }
    
    connectScrollRaf = requestAnimationFrame(tick)
  }

  function stopConnectAutoScroll() {
    if (connectScrollRaf) { 
      cancelAnimationFrame(connectScrollRaf)
      connectScrollRaf = null 
    }
    window.removeEventListener('mousemove', onConnectMouseMove)
  }

  function onConnectStart({ nodeId, handleId, handleType }) {
    const isGhost = nodeId === 'ghost-src' || nodeId === 'ghost-tgt'
    const uid  = isGhost ? nodeId : nodeId?.replace('src-', '').replace('tgt-', '')
    const side = nodeId === 'ghost-src' ? 'source'
               : nodeId === 'ghost-tgt' ? 'target'
               : handleType === 'source' ? 'source' : 'target'
               
    draggingFrom.value = { uid, side }
    startConnectAutoScroll()
  }

  function onConnectEnd() {
    draggingFrom.value = null
    stopConnectAutoScroll()
  }

  onUnmounted(() => {
    stopConnectAutoScroll()
  })

  return {
    draggingFrom,
    onConnectStart,
    onConnectEnd,
  }
}