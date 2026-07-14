const berlinDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function berlinTimestamp(date = new Date()) {
  const parts = localParts(date);
  const millisecond = date.getUTCMilliseconds();
  const localTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    millisecond,
  );
  const offsetMinutes = Math.round((localTimeAsUtc - date.getTime()) / 60_000);

  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(
    parts.hour,
  )}:${pad(parts.minute)}:${pad(parts.second)}.${pad(
    millisecond,
    3,
  )}${formatOffset(offsetMinutes)}`;
}

function localParts(date: Date) {
  const parts = Object.fromEntries(
    berlinDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function formatOffset(offsetMinutes: number) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;

  return `${sign}${pad(hours)}:${pad(minutes)}`;
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}
