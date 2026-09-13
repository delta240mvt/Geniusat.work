const ISO_8601_DURATION_REGEX =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

export function parseIso8601DurationToSeconds(input: string): number {
  const match = input.trim().match(ISO_8601_DURATION_REGEX);

  if (!match) {
    throw new Error(`Unsupported ISO8601 duration: ${input}`);
  }

  const [, years, months, weeks, days, hours, minutes, seconds] = match;

  const totalSeconds =
    (Number(years ?? 0) * 365 * 24 * 60 * 60) +
    (Number(months ?? 0) * 30 * 24 * 60 * 60) +
    (Number(weeks ?? 0) * 7 * 24 * 60 * 60) +
    (Number(days ?? 0) * 24 * 60 * 60) +
    (Number(hours ?? 0) * 60 * 60) +
    (Number(minutes ?? 0) * 60) +
    Number(seconds ?? 0);

  return totalSeconds;
}

export function toIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}
