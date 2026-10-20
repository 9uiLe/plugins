// Places a "同じコード" popover next to the point that opened it and lets the reader move it by its handle.
// Opening and closing stay with the popover API, so without this script the window still opens at its CSS position.
(() => {
  const margin = 8
  let opener = null
  document.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest(".same-code") : null
    if (!button) return
    const rect = button.getBoundingClientRect()
    // event.detail is 0 for keyboard activation, which has no pointer position.
    opener = event.detail ? { x: event.clientX, y: event.clientY } : { x: rect.left, y: rect.bottom }
  })
  // The CSS position anchors the window to viewport edges; a placed window keeps the CSS width (bounded by the viewport)
  // and only moves by left/top, so it stays inside a viewport that shrinks after it was placed.
  function detach(peek) {
    if (peek.dataset.placed) return
    Object.assign(peek.style, { right: "auto", bottom: "auto" })
    peek.dataset.placed = "true"
  }
  function place(peek, left, top) {
    detach(peek)
    const rect = peek.getBoundingClientRect(), width = document.documentElement.clientWidth, height = window.innerHeight
    peek.style.left = `${Math.min(Math.max(left, margin), Math.max(margin, width - rect.width - margin))}px`
    peek.style.top = `${Math.min(Math.max(top, margin), Math.max(margin, height - rect.height - margin))}px`
  }
  window.addEventListener("resize", () => {
    for (const peek of document.querySelectorAll(".code-peek[data-placed]:popover-open")) {
      const rect = peek.getBoundingClientRect()
      place(peek, rect.left, rect.top)
    }
  })
  for (const peek of document.querySelectorAll(".code-peek")) {
    peek.addEventListener("toggle", event => {
      if (event.newState !== "open" || !opener) return
      detach(peek)
      peek.style.maxHeight = ""
      const below = opener.y + 12, spaceBelow = window.innerHeight - margin - below, spaceAbove = opener.y - 12 - margin
      let height = peek.getBoundingClientRect().height
      // Covering the opener would hide the step the reader is comparing with, so a window that fits on neither side shrinks to the larger side.
      if (height > spaceBelow && height > spaceAbove) { peek.style.maxHeight = `${Math.max(spaceBelow, spaceAbove)}px`; height = peek.getBoundingClientRect().height }
      place(peek, opener.x - 24, height <= spaceBelow ? below : opener.y - 12 - height)
      opener = null
    })
    const handle = peek.querySelector(".code-peek-handle")
    if (!handle) continue
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return
      const rect = peek.getBoundingClientRect(), dx = event.clientX - rect.left, dy = event.clientY - rect.top
      handle.setPointerCapture(event.pointerId)
      const move = moveEvent => place(peek, moveEvent.clientX - dx, moveEvent.clientY - dy)
      const stop = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", stop); handle.removeEventListener("pointercancel", stop) }
      handle.addEventListener("pointermove", move)
      handle.addEventListener("pointerup", stop)
      handle.addEventListener("pointercancel", stop)
    })
    handle.addEventListener("keydown", event => {
      const step = event.shiftKey ? 64 : 16
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
      if (!delta) return
      event.preventDefault()
      const rect = peek.getBoundingClientRect()
      place(peek, rect.left + delta[0], rect.top + delta[1])
    })
  }
})()
