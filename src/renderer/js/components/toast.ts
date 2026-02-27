const containerEl = document.getElementById('toast-container')!

let hideTimer: ReturnType<typeof setTimeout> | null = null

function show(message: string, action?: { label: string; onClick: () => void }) {
  containerEl.textContent = ''

  const textNode = document.createTextNode(message)
  containerEl.appendChild(textNode)

  if (action) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = action.label
    btn.className = 'toast-action'
    btn.addEventListener('click', action.onClick)
    containerEl.appendChild(btn)
  }

  containerEl.classList.remove('hidden', 'toast-hidden')
  containerEl.classList.add('toast-visible')

  if (hideTimer) clearTimeout(hideTimer)

  if (!action) {
    hideTimer = setTimeout(() => {
      containerEl.classList.remove('toast-visible')
      containerEl.classList.add('toast-hidden')
      setTimeout(() => {
        containerEl.classList.add('hidden')
      }, 200)
      hideTimer = null
    }, 5000)
  }
}

export { show }
