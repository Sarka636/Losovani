import * as XLSX from 'xlsx';

const HEADER_KEYWORDS = [
  'jméno',
  'jmeno',
  'příjmení',
  'prijmeni',
  'student',
  'žák',
  'zak',
  'name',
  'first name',
  'last name',
  'surname',
  'číslo',
  'cislo',
  'pořadí',
  'poradi',
  'id',
  'třída',
  'trida',
  'email',
  'poznámka',
];

export function isLikelyHeader(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return HEADER_KEYWORDS.some(
    (kw) => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw)
  );
}

export function cleanStudentName(raw: string): string {
  // Remove leading numbers like "1.", "01)", "1 - "
  let cleaned = raw.replace(/^(\d+[\.\)\-:]\s*)+/, '').trim();
  // Clean double spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
}

export interface SheetClassResult {
  className: string;
  names: string[];
}

/**
 * Extracts student names from a single XLSX worksheet
 */
export function parseWorksheetToNames(worksheet: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, blankrows: false });
  if (!rows || rows.length === 0) return [];

  const detectedNames: string[] = [];
  let startIndex = 0;

  if (rows.length > 1) {
    const firstRowStr = rows[0].map((cell) => String(cell || '').trim()).join(' ');
    if (firstRowStr.split(' ').some((word) => isLikelyHeader(word))) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Filter non-empty cells as strings, discard pure row IDs
    const cells = row
      .map((c) => (c !== null && c !== undefined ? String(c).trim() : ''))
      .filter((c) => c.length > 0 && isNaN(Number(c)));

    if (cells.length === 0) continue;

    let candidateName = '';

    if (cells.length === 1) {
      candidateName = cells[0];
    } else if (cells.length >= 2) {
      const hasFullnameCell = cells.find(
        (c) => c.includes(' ') && !c.includes('@') && !c.includes('http')
      );
      if (hasFullnameCell) {
        candidateName = hasFullnameCell;
      } else {
        const validNameParts = cells.filter(
          (c) => !c.includes('@') && !c.includes('http') && c.length < 40
        );
        if (validNameParts.length >= 2) {
          candidateName = `${validNameParts[0]} ${validNameParts[1]}`;
        } else if (validNameParts.length === 1) {
          candidateName = validNameParts[0];
        }
      }
    }

    const cleaned = cleanStudentName(candidateName);
    if (cleaned.length >= 2 && !isLikelyHeader(cleaned)) {
      detectedNames.push(cleaned);
    }
  }

  return Array.from(new Set(detectedNames));
}

/**
 * Parses all sheets in a multi-sheet XLSX workbook.
 * Every sheet whose name represents a class will be parsed.
 */
export function parseAllSheetsWorkbook(buffer: ArrayBuffer): SheetClassResult[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const results: SheetClassResult[] = [];

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return results;
  }

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const names = parseWorksheetToNames(worksheet);
    if (names.length > 0) {
      results.push({
        className: sheetName.trim(),
        names,
      });
    }
  }

  return results;
}

/**
 * Parses a single file uploaded by the user.
 * Returns suggestedClassName and names.
 */
export async function parseFileToStudentNames(file: File): Promise<{
  suggestedClassName: string;
  names: string[];
  allSheets?: SheetClassResult[];
}> {
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const suggestedClassName =
    baseName
      .replace(/[_-]+/g, ' ')
      .replace(/\s*(seznam|studenti|trida|třída)\s*/gi, ' ')
      .trim() || 'Nová třída';

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Soubor neobsahuje žádné listy');
  }

  // Parse all sheets
  const allSheets = parseAllSheetsWorkbook(buffer);

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const detectedNames = parseWorksheetToNames(worksheet);

  if (detectedNames.length === 0 && allSheets.length === 0) {
    throw new Error('V souboru nebyla nalezena žádná jména studentů');
  }

  return {
    suggestedClassName: workbook.SheetNames.length === 1 ? suggestedClassName : sheetName,
    names: detectedNames,
    allSheets: allSheets.length > 1 ? allSheets : undefined,
  };
}

/**
 * Exports multiple classes with students to a single XLSX file.
 * Each class is placed in its own sheet (záložka), named after the class.
 */
export function exportClassesToXlsxBlob(
  classesData: { name: string; students: string[] }[]
): Blob {
  const wb = XLSX.utils.book_new();

  for (const item of classesData) {
    // Excel sheet name max 31 chars and no illegal characters: \ / ? * : [ ]
    const safeSheetName =
      item.name.replace(/[\\/?*:[\]]/g, ' ').trim().slice(0, 31) || 'Třída';

    const sheetData = [['Jméno a příjmení'], ...item.students.map((name) => [name])];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column width
    ws['!cols'] = [{ wch: 30 }];

    // Handle unique sheet names in case of collision
    let finalSheetName = safeSheetName;
    let counter = 1;
    while (wb.SheetNames.includes(finalSheetName)) {
      const suffix = ` (${counter++})`;
      finalSheetName = `${safeSheetName.slice(0, 31 - suffix.length)}${suffix}`;
    }

    XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Triggers browser download for a Blob
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Legacy placeholder - tridy.xlsx loading has been cancelled per user request.
 * CSV files in public/ are the single source of truth.
 */
export async function fetchDefaultClassesFromRepo(): Promise<SheetClassResult[] | null> {
  return null;
}

/**
 * Parses raw CSV content (string or ArrayBuffer) and returns an array of student names
 */
export function parseCsvContentToStudentNames(csvContent: string | ArrayBuffer): string[] {
  try {
    let workbook: XLSX.WorkBook;
    if (typeof csvContent === 'string') {
      workbook = XLSX.read(csvContent, { type: 'string' });
    } else {
      workbook = XLSX.read(csvContent, { type: 'array' });
    }
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) return [];
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return parseWorksheetToNames(sheet);
  } catch (err) {
    console.warn('Error parsing CSV content with XLSX:', err);
    if (typeof csvContent === 'string') {
      const lines = csvContent.split(/\r?\n/);
      const names: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || isLikelyHeader(trimmed)) continue;
        const cleaned = cleanStudentName(trimmed);
        if (cleaned.length >= 2 && !isLikelyHeader(cleaned)) {
          names.push(cleaned);
        }
      }
      return Array.from(new Set(names));
    }
    return [];
  }
}

/**
 * Probes GitHub API when running on GitHub Pages (username.github.io/repo)
 * to automatically discover all .csv files in the repo's public/ or docs/ folders.
 */
async function discoverGitHubPagesCsvs(): Promise<Array<{ filename: string; className: string; url: string }>> {
  if (typeof window === 'undefined') return [];
  const host = window.location.hostname;
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (!host.endsWith('.github.io') || pathParts.length === 0) {
    return [];
  }

  const owner = host.replace(/\.github\.io$/i, '');
  const repo = pathParts[0];
  const results: Array<{ filename: string; className: string; url: string }> = [];
  const seenFiles = new Set<string>();

  // Check both /public and /docs in the repo via GitHub REST API
  for (const folder of ['public', 'docs']) {
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${folder}`;
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github.v3+json' },
        cache: 'no-cache',
      });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.name && item.name.toLowerCase().endsWith('.csv') && (item.type === 'file' || item.download_url)) {
              const lower = item.name.toLowerCase();
              if (!seenFiles.has(lower)) {
                seenFiles.add(lower);
                results.push({
                  filename: item.name,
                  className: item.name.replace(/\.csv$/i, ''),
                  url: item.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/main/${folder}/${item.name}`,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`GitHub API discover for ${folder} warning:`, e);
    }
  }

  return results;
}

/**
 * Searches and fetches all CSV files located in public/.
 * The class name is the file name without .csv.
 */
export async function fetchPublicCsvClasses(): Promise<SheetClassResult[]> {
  const base = import.meta.env.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : base + '/';
  const results: SheetClassResult[] = [];
  const processedFiles = new Set<string>();

  // 0. Try backend API first if available (local development with server.ts)
  try {
    const apiRes = await fetch('/api/public-csvs', { method: 'GET' });
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData && Array.isArray(apiData.files) && apiData.files.length > 0) {
        for (const f of apiData.files) {
          if (f.className && Array.isArray(f.names) && f.names.length > 0) {
            results.push({
              className: f.className,
              names: f.names,
            });
            processedFiles.add(String(f.filename || f.className).toLowerCase());
          }
        }
        if (results.length > 0) {
          return results;
        }
      }
    }
  } catch {
    // Continue with static manifest / file fetches
  }

  // 1. On GitHub Pages, dynamically discover all CSVs in repo's public/ and docs/ via GitHub API
  try {
    const ghFiles = await discoverGitHubPagesCsvs();
    for (const gf of ghFiles) {
      if (processedFiles.has(gf.filename.toLowerCase())) continue;
      try {
        const ghRes = await fetch(`${gf.url}?t=${Date.now()}`, { cache: 'no-cache' });
        if (ghRes.ok) {
          const text = await ghRes.text();
          if (text && text.trim().length > 0) {
            const names = parseCsvContentToStudentNames(text);
            if (names.length > 0) {
              results.push({
                className: gf.className,
                names,
              });
              processedFiles.add(gf.filename.toLowerCase());
            }
          }
        }
      } catch (err) {
        console.warn(`Could not fetch discovered GitHub file ${gf.filename}:`, err);
      }
    }
    if (results.length > 0) {
      return results;
    }
  } catch (err) {
    console.warn('GitHub Pages discovery error:', err);
  }

  // 2. Try to fetch csv-manifest.json
  const manifestPaths = [
    `${cleanBase}csv-manifest.json`,
    './csv-manifest.json',
    'csv-manifest.json',
    '/csv-manifest.json',
    `${cleanBase}public/csv-manifest.json`,
    './public/csv-manifest.json',
  ];

  let filenamesToFetch: string[] = [];

  for (const mp of manifestPaths) {
    try {
      const res = await fetch(`${mp}?t=${Date.now()}`, { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('text/html')) continue;
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            const fname = typeof item === 'string' ? item : item?.filename;
            if (fname && typeof fname === 'string') {
              filenamesToFetch.push(fname);
            }
          }
          if (filenamesToFetch.length > 0) break;
        }
      }
    } catch {
      // Continue searching
    }
  }

  // 3. Fallback candidate filenames if manifest is not present or empty
  const fallbackCandidates = [
    '1E.csv',
    '3A_a.csv',
    '3A_b.csv',
    '3A_1.csv',
    '3A_2.csv',
    '1.E.csv',
    '3.A.csv',
    'trida1E.csv',
    'trida.csv',
    '1A.csv',
    '1B.csv',
    '2A.csv',
    '2B.csv',
    '3A.csv',
    '3B.csv',
    '4A.csv',
    '4B.csv',
  ];

  for (const fc of fallbackCandidates) {
    if (!filenamesToFetch.includes(fc)) {
      filenamesToFetch.push(fc);
    }
  }

  // Detect GitHub owner / repo for direct raw.githubusercontent.com candidate paths
  let ghOwner = '';
  let ghRepo = '';
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
    ghOwner = window.location.hostname.replace(/\.github\.io$/i, '');
    const pparts = window.location.pathname.split('/').filter(Boolean);
    if (pparts.length > 0) {
      ghRepo = pparts[0];
    }
  }

  // 4. Fetch and parse each CSV
  for (const filename of filenamesToFetch) {
    const cleanFilename = filename.trim();
    if (processedFiles.has(cleanFilename.toLowerCase())) continue;

    const className = cleanFilename.replace(/\.csv$/i, '').trim();
    if (!className) continue;

    const possiblePaths = [
      `${cleanBase}${cleanFilename}`,
      `./${cleanFilename}`,
      cleanFilename,
      `/${cleanFilename}`,
      `${cleanBase}public/${cleanFilename}`,
      `./public/${cleanFilename}`,
    ];

    if (ghOwner && ghRepo) {
      possiblePaths.push(
        `https://raw.githubusercontent.com/${ghOwner}/${ghRepo}/main/public/${cleanFilename}`,
        `https://raw.githubusercontent.com/${ghOwner}/${ghRepo}/main/docs/${cleanFilename}`,
        `https://raw.githubusercontent.com/${ghOwner}/${ghRepo}/master/public/${cleanFilename}`,
        `https://raw.githubusercontent.com/${ghOwner}/${ghRepo}/master/docs/${cleanFilename}`
      );
    }

    for (const p of possiblePaths) {
      try {
        const res = await fetch(`${p}?t=${Date.now()}`, { method: 'GET', cache: 'no-cache' });
        if (res.ok) {
          const ct = res.headers.get('content-type');
          if (ct && ct.includes('text/html')) continue;

          const text = await res.text();
          if (text && text.trim().length > 0) {
            const names = parseCsvContentToStudentNames(text);
            if (names.length > 0) {
              results.push({
                className,
                names,
              });
              processedFiles.add(cleanFilename.toLowerCase());
              break;
            }
          }
        }
      } catch {
        // Try next candidate path
      }
    }
  }

  return results;
}
