class CategoryDetail {
  constructor() {
    this.overlay = document.getElementById('category-modal')
    this.titleEl = document.getElementById('modal-title')
    this.totalEl = document.getElementById('modal-total')
    this.colorDot = document.getElementById('modal-color-dot')
    this.appList = document.getElementById('modal-app-list')
    this.closeBtn = document.getElementById('modal-close')

    this.closeBtn.addEventListener('click', () => this.close())
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
        this.close()
      }
    })
  }

  async open(category, color, totalMs, startMs, endMs) {
    this.titleEl.textContent = category
    this.colorDot.style.background = color
    this.totalEl.textContent = formatDuration(totalMs)
    this.appList.innerHTML = ''

    this.overlay.classList.remove('hidden')

    try {
      const allApps = await window.monitor.getAppsByCategory(category, startMs, endMs)
      const apps = allApps.filter((a) => a.total_ms >= 60000)

      if (!apps.length) {
        this.appList.innerHTML = '<div class="modal-empty">No apps found in this category</div>'
        return
      }

      const maxMs = apps[0].total_ms

      apps.forEach((app, i) => {
        const pct = maxMs > 0 ? (app.total_ms / maxMs) * 100 : 0
        const item = document.createElement('div')
        item.className = 'modal-app-item'
        item.innerHTML = `
          <span class="modal-app-rank">${i + 1}</span>
          <div class="modal-app-info">
            <div class="modal-app-name">${this._escapeHtml(app.app_name)}</div>
            <div class="modal-app-bar-container">
              <div class="modal-app-bar" style="width: ${pct}%; background: ${color};"></div>
            </div>
          </div>
          <span class="modal-app-duration">${formatDuration(app.total_ms)}</span>
        `
        this.appList.appendChild(item)
      })
    } catch (err) {
      this.appList.innerHTML = '<div class="modal-empty">Failed to load app details</div>'
    }
  }

  close() {
    this.overlay.classList.add('hidden')
  }

  _escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }
}
