import {
  INVITATION_CSV_TEMPLATE,
  parseInvitationCsv,
  splitCsvLine,
  isPlausibleEmail,
} from './invitation-csv';

describe('invitation CSV', () => {
  it('parses the shipped template', () => {
    const rows = parseInvitationCsv(INVITATION_CSV_TEMPLATE);
    expect(rows).toEqual([
      { line: 2, email: 'alice@example.com', role: 'member' },
      { line: 3, email: 'bob@example.com', role: 'manager' },
      { line: 4, email: 'carol@example.com', role: 'viewer' },
    ]);
  });

  it('requires email and role headers', () => {
    expect(() => parseInvitationCsv('name,role\na,member\n')).toThrow(/email/);
  });

  it('supports quoted commas', () => {
    expect(splitCsvLine('"a,b",member')).toEqual(['a,b', 'member']);
  });

  it('validates emails loosely', () => {
    expect(isPlausibleEmail('a@b.co')).toBe(true);
    expect(isPlausibleEmail('not-an-email')).toBe(false);
  });
});
