/**
 * Minimal CSV helpers for member invitation imports.
 * Expected columns: email, role (role key). Header row required.
 */

export const INVITATION_IMPORT_MAX_ROWS = 100;
export const INVITATION_IMPORT_MAX_BYTES = 100 * 1024;

export const INVITATION_CSV_TEMPLATE = `email,role
alice@example.com,member
bob@example.com,manager
carol@example.com,viewer
`;

export interface InvitationCsvRow {
  line: number;
  email: string;
  role: string;
}

/** Splits a CSV line on commas, supporting simple double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/^\uFEFF/, '');
}

/**
 * Parses invitation CSV text into rows. Throws a plain Error with a user-facing message
 * for structural problems (missing header, too many rows, unknown columns).
 */
export function parseInvitationCsv(text: string): InvitationCsvRow[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error('The file is empty');

  const header = splitCsvLine(lines[0]!).map(normalizeHeader);
  const emailIdx = header.indexOf('email');
  const roleIdx = header.indexOf('role');
  if (emailIdx === -1 || roleIdx === -1) {
    throw new Error('CSV must include an "email" and a "role" column in the header row');
  }

  const dataLines = lines.slice(1);
  if (dataLines.length === 0) throw new Error('CSV has a header but no data rows');
  if (dataLines.length > INVITATION_IMPORT_MAX_ROWS) {
    throw new Error(`CSV may contain at most ${String(INVITATION_IMPORT_MAX_ROWS)} data rows`);
  }

  return dataLines.map((line, index) => {
    const cells = splitCsvLine(line);
    return {
      line: index + 2, // 1-based file line (header is line 1)
      email: (cells[emailIdx] ?? '').trim().toLowerCase(),
      role: (cells[roleIdx] ?? '').trim(),
    };
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmail(email: string): boolean {
  return email.length > 0 && email.length <= 254 && EMAIL_RE.test(email);
}
