/**
 * Formats a raw UUID or identifier into a clean task short form.
 * e.g., "a273f4db-f9df-48fc-8e86-671ce747a539" -> "PROJ-A273F4" or "TSK-A273F4"
 */
export const getShortId = (id, domain = '') => {
  if (!id) return '';

  const clean = String(id).trim();

  // If already formatted like "PROJ-101" or "PROF-001", return clean
  if (/^[A-Z0-9]+-[0-9]{1,4}$/i.test(clean)) {
    return clean.toUpperCase();
  }

  const domainPrefixes = {
    projects: 'PROJ',
    academic: 'ACAD',
    events: 'EVNT',
    teams: 'TEAM',
  };

  const prefix = domainPrefixes[domain?.toLowerCase()] || 'TSK';
  const rawHex = clean.replace(/[^a-f0-9]/gi, '');
  const shortHash = (rawHex.length >= 6 ? rawHex.slice(0, 6) : clean).toUpperCase();

  return `${prefix}-${shortHash}`;
};
