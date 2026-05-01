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
 * @param {Array<{date:string, segments:{start:string,end:string}[]}>} monthlyAvailability
 * @param {Date[]} appointments doctor appointments start/end as Date
 * @param {string} fromKey YYYY-MM-DD
 * @param {number} numDays
 * @param {number} slotMinutes
 */
export function generateAvailableSlots(monthlyAvailability, busyIntervals, fromKey, numDays, slotMinutes = 30) {
  if (!monthlyAvailability?.length) return [];
  const now = new Date();
  const slots = [];
  const fromDate = new Date(fromKey + "T00:00:00");
  const endDate = addDays(fromDate, numDays);

  for (const row of monthlyAvailability) {
    const rowDate = new Date(row.date + "T00:00:00");
    if (rowDate < startOfDay(now) || rowDate > endDate) continue;
    
    for (const seg of row.segments) {
      let cur = parseHM(seg.start);
      const end = parseHM(seg.end);
      if (Number.isNaN(cur) || Number.isNaN(end) || cur >= end) continue;

      while (cur + slotMinutes <= end) {
        const start = localDateAtMinutes(row.date, cur);
        const endAt = localDateAtMinutes(row.date, cur + slotMinutes);
        if (endAt > start) {
          const overlaps = busyIntervals.some((b) => b.startAt < endAt && b.endAt > start);
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
