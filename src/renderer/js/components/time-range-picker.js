class TimeRangePicker {
  constructor(onRangeChange) {
    this.onRangeChange = onRangeChange
    this.buttons = document.querySelectorAll('.range-btn')
    this.customRange = document.getElementById('custom-range')
    this.startDate = document.getElementById('start-date')
    this.endDate = document.getElementById('end-date')
    this.applyBtn = document.getElementById('apply-range')

    this._bindEvents()
  }

  _bindEvents() {
    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.buttons.forEach((b) => {
          b.classList.remove('active')
        })
        btn.classList.add('active')

        const range = btn.dataset.range
        if (range === 'custom') {
          this.customRange.classList.remove('hidden')
          return
        }

        this.customRange.classList.add('hidden')

        if (range === 'today') this.onRangeChange(DateUtils.getToday())
        else if (range === 'week') this.onRangeChange(DateUtils.getThisWeek())
        else if (range === 'month') this.onRangeChange(DateUtils.getThisMonth())
      })
    })

    this.applyBtn.addEventListener('click', () => {
      const start = this.startDate.value
      const end = this.endDate.value
      if (start && end) {
        this.onRangeChange(DateUtils.getCustomRange(start, end))
      }
    })
  }
}
