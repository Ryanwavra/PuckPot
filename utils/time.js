// utils/time.js

// Current time in EST
function nowEST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

// Contest window: 7 AM EST → 6:59:59 AM next day
function getContestWindowEST(base = nowEST()) {
  const start = new Date(base);
  start.setHours(7, 0, 0, 0);
  if (base < start) start.setDate(start.getDate() - 1); // roll back if before 7 AM
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1);
  return { start, end };
}

// Contest ID = YYYY-MM-DD (based on contest start date in EST)
function contestIdEST(base = nowEST()) {
  const { start } = getContestWindowEST(base);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Convert NHL UTC timestamp → EST Date
function toEST(dateStrUTC) {
  const utc = new Date(dateStrUTC);
  return new Date(utc.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

module.exports = { nowEST, getContestWindowEST, contestIdEST, toEST };