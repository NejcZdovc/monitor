/**
 * Tests for the hour-boundary splitting utility functions.
 * These are pure functions with no side effects — no mocks needed.
 */

import { getHourBoundaries, getHourNumber, splitTimeRange } from '../src/main/tracking/hour-split'

const ONE_HOUR = 3600000

// Reference time: 2024-01-15 14:00:00 UTC (exact hour boundary)
const HOUR_14 = Math.floor(1705323600000 / ONE_HOUR) * ONE_HOUR

describe('getHourNumber', () => {
  test('returns correct hour for timestamp at exact boundary', () => {
    expect(getHourNumber(HOUR_14)).toBe(HOUR_14 / ONE_HOUR)
  })

  test('returns same hour for timestamps within the same hour', () => {
    const hourNum = getHourNumber(HOUR_14)
    expect(getHourNumber(HOUR_14 + 1)).toBe(hourNum)
    expect(getHourNumber(HOUR_14 + 30 * 60000)).toBe(hourNum)
    expect(getHourNumber(HOUR_14 + ONE_HOUR - 1)).toBe(hourNum)
  })

  test('returns next hour for timestamp at next boundary', () => {
    expect(getHourNumber(HOUR_14 + ONE_HOUR)).toBe(getHourNumber(HOUR_14) + 1)
  })

  test('returns 0 for timestamp 0', () => {
    expect(getHourNumber(0)).toBe(0)
  })
})

describe('getHourBoundaries', () => {
  test('returns empty array when target equals session hour', () => {
    const hourNum = getHourNumber(HOUR_14 + 30 * 60000)
    expect(getHourBoundaries(HOUR_14 + 30 * 60000, hourNum)).toEqual([])
  })

  test('returns empty array when target is before session hour', () => {
    const hourNum = getHourNumber(HOUR_14 + 30 * 60000)
    expect(getHourBoundaries(HOUR_14 + 30 * 60000, hourNum - 1)).toEqual([])
  })

  test('returns one boundary for single hour crossing', () => {
    const result = getHourBoundaries(HOUR_14 + 55 * 60000, getHourNumber(HOUR_14) + 1)
    expect(result).toEqual([HOUR_14 + ONE_HOUR])
  })

  test('returns multiple boundaries for multi-hour crossing', () => {
    const result = getHourBoundaries(HOUR_14 + 30 * 60000, getHourNumber(HOUR_14) + 3)
    expect(result).toEqual([HOUR_14 + ONE_HOUR, HOUR_14 + 2 * ONE_HOUR, HOUR_14 + 3 * ONE_HOUR])
  })

  test('works when session starts exactly on a boundary', () => {
    const result = getHourBoundaries(HOUR_14, getHourNumber(HOUR_14) + 2)
    expect(result).toEqual([HOUR_14 + ONE_HOUR, HOUR_14 + 2 * ONE_HOUR])
  })

  test('boundaries are in ascending order', () => {
    const result = getHourBoundaries(HOUR_14 + 10 * 60000, getHourNumber(HOUR_14) + 5)
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThan(result[i - 1])
    }
  })

  test('all boundaries are exact hour multiples', () => {
    const result = getHourBoundaries(HOUR_14 + 23 * 60000, getHourNumber(HOUR_14) + 4)
    for (const boundary of result) {
      expect(boundary % ONE_HOUR).toBe(0)
    }
  })
})

describe('splitTimeRange', () => {
  test('returns single segment when range is within one hour', () => {
    const start = HOUR_14 + 10 * 60000
    const end = HOUR_14 + 40 * 60000
    const result = splitTimeRange(start, end)

    expect(result).toEqual([{ startedAt: start, endedAt: end, durationMs: end - start }])
  })

  test('splits at one hour boundary', () => {
    const start = HOUR_14 + 50 * 60000
    const end = HOUR_14 + ONE_HOUR + 10 * 60000
    const boundary = HOUR_14 + ONE_HOUR
    const result = splitTimeRange(start, end)

    expect(result).toEqual([
      { startedAt: start, endedAt: boundary, durationMs: boundary - start },
      { startedAt: boundary, endedAt: end, durationMs: end - boundary },
    ])
  })

  test('splits at multiple hour boundaries', () => {
    const start = HOUR_14 + 45 * 60000
    const end = HOUR_14 + 3 * ONE_HOUR + 15 * 60000
    const result = splitTimeRange(start, end)

    expect(result.length).toBe(4) // 3 boundaries + 1 final segment
  })

  test('total duration of all segments equals original range', () => {
    const start = HOUR_14 + 23 * 60000
    const end = HOUR_14 + 5 * ONE_HOUR + 41 * 60000
    const result = splitTimeRange(start, end)

    const total = result.reduce((sum, seg) => sum + seg.durationMs, 0)
    expect(total).toBe(end - start)
  })

  test('all segments have positive duration', () => {
    const start = HOUR_14 + 30 * 60000
    const end = HOUR_14 + 8.5 * ONE_HOUR
    const result = splitTimeRange(start, end)

    for (const seg of result) {
      expect(seg.durationMs).toBeGreaterThan(0)
      expect(seg.endedAt - seg.startedAt).toBe(seg.durationMs)
    }
  })

  test('no segment crosses an hour boundary', () => {
    const start = HOUR_14 + 45 * 60000
    const end = HOUR_14 + 5 * ONE_HOUR + 20 * 60000
    const result = splitTimeRange(start, end)

    for (const seg of result) {
      const startHour = Math.floor(seg.startedAt / ONE_HOUR)
      const endHour = Math.floor((seg.endedAt - 1) / ONE_HOUR)
      expect(endHour).toBeLessThanOrEqual(startHour)
    }
  })

  test('segments are contiguous (no gaps)', () => {
    const start = HOUR_14 + 10 * 60000
    const end = HOUR_14 + 4 * ONE_HOUR + 50 * 60000
    const result = splitTimeRange(start, end)

    expect(result[0].startedAt).toBe(start)
    expect(result[result.length - 1].endedAt).toBe(end)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startedAt).toBe(result[i - 1].endedAt)
    }
  })

  test('handles range starting exactly on boundary', () => {
    const start = HOUR_14
    const end = HOUR_14 + ONE_HOUR + 30 * 60000
    const result = splitTimeRange(start, end)

    expect(result.length).toBe(2)
    expect(result[0].startedAt).toBe(HOUR_14)
    expect(result[0].endedAt).toBe(HOUR_14 + ONE_HOUR)
    expect(result[1].startedAt).toBe(HOUR_14 + ONE_HOUR)
    expect(result[1].endedAt).toBe(end)
  })

  test('handles range ending exactly on boundary', () => {
    const start = HOUR_14 + 30 * 60000
    const end = HOUR_14 + ONE_HOUR
    const result = splitTimeRange(start, end)

    // endHour = getHourNumber(15:00:00) = hour 15, startHour = hour 14
    // So there is one boundary at 15:00 — but cursor would advance to 15:00
    // and final segment would be [15:00, 15:00] with duration 0.
    // Actually: the loop runs for h=15, creates [14:30, 15:00], then
    // final segment is [15:00, 15:00] with duration 0.
    expect(result.length).toBe(2)
    expect(result[0]).toEqual({ startedAt: start, endedAt: end, durationMs: end - start })
    expect(result[1]).toEqual({ startedAt: end, endedAt: end, durationMs: 0 })
  })
})
