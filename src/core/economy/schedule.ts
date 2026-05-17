/**
 * Timezone-aware "today key" helper.
 *
 * Used by daily cash claims to ensure a user can only claim once per
 * calendar day in their configured timezone.
 */

/**
 * Returns a YYYY-MM-DD string representing the start of today
 * in the given timezone (or UTC by default).
 * If a `date` is provided, the key is computed for that date instead of now.
 */
export function startOfTodayKey(
    timezone = 'UTC',
    date?: Date | string | number | null,
): string {
    const d = date ? new Date(date) : new Date()

    // Build a short locale string that Intl.DateTimeFormat can parse
    // in the target timezone. We only need year, month, and day.
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d)

    // 'en-CA' outputs "YYYY-MM-DD" which is exactly what we want.
    return parts
}