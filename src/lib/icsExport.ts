// Generates an .ics file (RFC 5545) for a single event and triggers download.
// Minimal but correct — imports cleanly into Apple Calendar, Outlook and Google.

function toIcsDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escape(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export interface IcsEventInput {
  uid?: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  start_at: string;
  end_at: string;
  rrule?: string | null;
}

export function buildIcs(ev: IcsEventInput): string {
  const uid = ev.uid || `${Date.now()}-${Math.random().toString(36).slice(2)}@squaad.com.br`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//+ que Vencedores//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(ev.start_at)}`,
    `DTEND:${toIcsDate(ev.end_at)}`,
    `SUMMARY:${escape(ev.title)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escape(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${escape(ev.location)}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  if (ev.rrule) lines.push(`RRULE:${ev.rrule}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(ev: IcsEventInput) {
  const ics = buildIcs(ev);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(ev.title || 'evento').toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
