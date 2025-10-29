// utils/time.js

// Detect if a given date is in US Eastern Daylight Time (DST)
function isEasternDST(date = new Date()) {
  // Jan and July offsets in minutes
  const jan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const jul = new Date(Date.UTC(date.getUTCFullYear(), 6, 1));
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return date.getTimezoneOffset() < stdOffset;
}

// Get contest window in UTC
function getContestWindowUTC(base = new Date()) {
  const resetHourUTC = isEasternDST(base) ? 11 : 12; // 11 UTC in summer, 12 UTC in winter

  // Start of contest window
  const start = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    resetHourUTC, 0, 0, 0
  ));

  // If current time is before reset, roll back to yesterday’s reset
  if (base < start) start.setUTCDate(start.getUTCDate() - 1);

  // End = start + 24h
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setMilliseconds(-1);

  return { start, end };
}

// Contest ID (YYYY-MM-DD based on UTC reset)
function contestIdUTC(base = new Date()) {
  const { start } = getContestWindowUTC(base);
  return start.toISOString().slice(0, 10);
}

module.exports = { getContestWindowUTC, contestIdUTC };