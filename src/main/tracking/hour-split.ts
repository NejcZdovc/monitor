import { ONE_HOUR_MS } from '../constants'

/**
 * Returns the epoch hour number for a given timestamp.
 * Replaces the pattern: Math.floor(timestampMs / 3600000)
 */
function getHourNumber(timestampMs: number): number {
  return Math.floor(timestampMs / ONE_HOUR_MS)
}

/**
 * Computes hour-boundary timestamps between a session's start hour and a target hour.
 * Returns an empty array if no split is needed (targetHour <= sessionHour).
 *
 * Example: session at 14:55, targetHour = 16
 *   → [15:00:00.000, 16:00:00.000]
 */
function getHourBoundaries(sessionStartedAt: number, targetHour: number): number[] {
  const sessionHour = getHourNumber(sessionStartedAt)
  if (targetHour <= sessionHour) return []

  const boundaries: number[] = []
  for (let h = sessionHour + 1; h <= targetHour; h++) {
    boundaries.push(h * ONE_HOUR_MS)
  }
  return boundaries
}

/**
 * Splits a known time range [startedAt, endedAt] into segments at hour boundaries.
 * Each segment has startedAt, endedAt, and durationMs.
 * Used for pre-split inserts (e.g. idle sessions that are inserted as complete records).
 *
 * Always returns at least one segment.
 */
function splitTimeRange(
  startedAt: number,
  endedAt: number,
): Array<{ startedAt: number; endedAt: number; durationMs: number }> {
  const startHour = getHourNumber(startedAt)
  const endHour = getHourNumber(endedAt)

  const segments: Array<{ startedAt: number; endedAt: number; durationMs: number }> = []
  let cursor = startedAt

  for (let h = startHour + 1; h <= endHour; h++) {
    const boundary = h * ONE_HOUR_MS
    segments.push({ startedAt: cursor, endedAt: boundary, durationMs: boundary - cursor })
    cursor = boundary
  }
  // Final segment (or only segment if no boundary crossed)
  segments.push({ startedAt: cursor, endedAt, durationMs: endedAt - cursor })

  return segments
}

export { getHourBoundaries, getHourNumber, splitTimeRange }
