// utils/time.js

// Detect if a given date is in US Eastern Daylight Time (DST)
export function isEasternDST(date = new Date()) {
  const jan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const jul = new Date(Date.UTC(date.getUTCFullYear(), 6, 1));
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return date.getTimezoneOffset() < stdOffset;
}

// ----------------- UTC HELPERS -----------------

// Get contest window in UTC
export function getContestWindowUTC(base = new Date()) {
  const resetHourUTC = isEasternDST(base) ? 11 : 12; // 11 UTC in summer, 12 UTC in winter

  const start = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    resetHourUTC, 0, 0, 0
  ));

  if (base < start) start.setUTCDate(start.getUTCDate() - 1);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setMilliseconds(-1);

  return { start, end };
}

// Contest ID (YYYY-MM-DD based on UTC reset)
export function contestIdUTC(base = new Date()) {
  const { start } = getContestWindowUTC(base);
  return start.toISOString().slice(0, 10);
}

// ----------------- EST HELPERS -----------------

// Current time in EST as a Date
export function nowEST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

// Contest window in EST (converted from UTC window)
export function getContestWindowEST(base = new Date()) {
  const { start, end } = getContestWindowUTC(base);
  return {
    start: new Date(
      start.toLocaleString("en-US", { timeZone: "America/New_York" })
    ),
    end: new Date(
      end.toLocaleString("en-US", { timeZone: "America/New_York" })
    )
  };
}

// Contest ID based on EST reset
export function contestIdEST(base = new Date()) {
  const estDate = new Date(
    base.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  return estDate.toISOString().slice(0, 10);
}

// Convert any Date → EST Date
export function toEST(date) {
  return new Date(
    new Date(date).toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}