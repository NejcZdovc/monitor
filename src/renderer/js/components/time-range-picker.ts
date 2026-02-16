import { getCustomRange, getThisMonth, getThisWeek, getToday, type TimeRange } from '../date-utils'

export class TimeRangePicker {
  onRangeChange: (range: TimeRange) => void
  buttons: NodeListOf<HTMLButtonElement>
  customRange: HTMLElement
  startDate: HTMLInputElement
  endDate: HTMLInputElement
  applyBtn: HTMLButtonElement

  constructor(onRangeChange: (range: TimeRange) => void) {
    this.onRangeChange = onRangeChange
    this.buttons = document.querySelectorAll('.range-btn')
    this.customRange = document.getElementById('custom-range')!
    this.startDate = document.getElementById('start-date') as HTMLInputElement
    this.endDate = document.getElementById('end-date') as HTMLInputElement
    this.applyBtn = document.getElementById('apply-range') as HTMLButtonElement

    this._bindEvents()
  }

  _bindEvents(): void {
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

        if (range === 'today') this.onRangeChange(getToday())
        else if (range === 'week') this.onRangeChange(getThisWeek())
        else if (range === 'month') this.onRangeChange(getThisMonth())
      })
    })

    this.applyBtn.addEventListener('click', () => {
      const start = this.startDate.value
      const end = this.endDate.value
      if (start && end) {
        this.onRangeChange(getCustomRange(start, end))
      }
    })
  }
}
