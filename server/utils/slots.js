/**
 * @param {string} hm "HH:mm" 24h
 * @returns {number} minutes from midnight
 */
export function parseHM(hm) {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dateKeyLocal(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const da = String(x.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function localDateAtMinutes(dateKeyStr, minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  const isoLocal = `${dateKeyStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  return new Date(isoLocal);
}

/**
 * @param {Array<{day:number, segments:{start:string,end:string}[]}>} weekly
 * @param {Date[]} appointments doctor appointments start/end as Date
 * @param {string} fromKey YYYY-MM-DD
 * @param {number} numDays
 * @param {number} slotMinutes
 */
export function generateAvailableSlots(weekly, busyIntervals, fromKey, numDays, slotMinutes = 30) {
  if (!weekly?.length) return [];

  const weeklyMap = new Map(weekly.map((w) => [w.day, w.segments || []]));
  const now = new Date();
  const slots = [];

  let cursor = new Date(fromKey + "T00:00:00");
  for (let i = 0; i < numDays; i++) {
    const dayDate = addDays(cursor, i);
    const key = dateKeyLocal(dayDate);
    const weekday = dayDate.getDay();
    const segments = weeklyMap.get(weekday);
    if (!segments?.length) continue;

    for (const seg of segments) {
      let cur = parseHM(seg.start);
      const end = parseHM(seg.end);
      if (Number.isNaN(cur) || Number.isNaN(end) || cur >= end) continue;

      while (cur + slotMinutes <= end) {
        const start = localDateAtMinutes(key, cur);
        const endAt = localDateAtMinutes(key, cur + slotMinutes);
        if (endAt > start) {
          const overlaps = busyIntervals.some(
            (b) => b.startAt < endAt && b.endAt > start,
          );
          if (!overlaps && start >= now) {
            slots.push({ start, end: endAt });
          }
        }
        cur += slotMinutes;
      }
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}
