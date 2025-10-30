// utils/time.js

const TZ = "America/New_York";

/**
 * Contest ID = the calendar day of the games in Eastern time
 * @param {Date} [date] - optional Date (defaults to now)
 * @returns {string} YYYY-MM-DD in EST/EDT
 */
export function getContestId(date = new Date()) {
  const est = new Date(date.toLocaleString("en-US", { timeZone: TZ }));
  const year = est.getFullYear();
  const month = String(est.getMonth() + 1).padStart(2, "0");
  const day = String(est.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Lock time = contest day 23:00 Eastern → UTC
 * @param {string} gameDateStr - "YYYY-MM-DD"
 * @returns {Date} UTC Date object
 */
export function getLockTimeUTC(gameDateStr) {
  const local = new Date(
    new Date(`${gameDateStr}T23:00:00`).toLocaleString("en-US", { timeZone: TZ })
  );
  return new Date(local.toISOString()); // UTC
}

/**
 * Reset time = next day 07:00 Eastern → UTC
 * @param {string} gameDateStr - "YYYY-MM-DD"
 * @returns {Date} UTC Date object
 */
export function getResetTimeUTC(gameDateStr) {
  // Start from midnight Eastern of contest day
  const base = new Date(
    new Date(`${gameDateStr}T00:00:00`).toLocaleString("en-US", { timeZone: TZ })
  );
  // Move to next day
  base.setDate(base.getDate() + 1);

  // Build 07:00 Eastern on that next day
  const resetLocal = new Date(
    new Date(
      `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(
        base.getDate()
      ).padStart(2, "0")}T07:00:00`
    ).toLocaleString("en-US", { timeZone: TZ })
  );

  return new Date(resetLocal.toISOString()); // UTC
}

/**
 * Convert UTC → Eastern
 * @param {Date} date - UTC Date
 * @returns {Date} Eastern Date
 */
export function toEST(date) {
  return new Date(date.toLocaleString("en-US", { timeZone: TZ }));
}

/**
 * Current time in Eastern
 * @returns {Date}
 */
export function nowEST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}