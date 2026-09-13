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
 * Attempts to fetch a default tridy.xlsx file from the repository/public root.
 * Returns the parsed sheets or null if not found.
 */
export async function fetchDefaultClassesFromRepo(): Promise<SheetClassResult[] | null> {
  const base = import.meta.env.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : base + '/';

  const possiblePaths = [
    `${cleanBase}tridy.xlsx`,
    './tridy.xlsx',
    'tridy.xlsx',
    '/tridy.xlsx',
    `${cleanBase}public/tridy.xlsx`,
    './public/tridy.xlsx',
  ];

  for (const p of possiblePaths) {
    try {
      const res = await fetch(p, { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        // ensure it didn't return an index.html fallback
        if (contentType && contentType.includes('text/html')) {
          continue;
        }
        const buffer = await res.arrayBuffer();
        if (buffer && buffer.byteLength > 100) {
          const parsed = parseAllSheetsWorkbook(buffer);
          if (parsed && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      // Continue to next path candidate
    }
  }

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
 * Searches and fetches all CSV files located in public/.
 * Uses csv-manifest.json or probes candidate filenames.
 * The class name is the file name without .csv.
 */
export async function fetchPublicCsvClasses(): Promise<SheetClassResult[]> {
  const base = import.meta.env.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : base + '/';

  const results: SheetClassResult[] = [];
  const processedFiles = new Set<string>();

  // 1. Try to fetch csv-manifest.json
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
      const res = await fetch(mp, { method: 'GET', cache: 'no-cache' });
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

  // 2. Fallback candidate standard filenames
  if (filenamesToFetch.length === 0) {
    filenamesToFetch = [
      '1.A.csv',
      '2.B.csv',
      'Kvarta.csv',
      '1A.csv',
      '1B.csv',
      '2A.csv',
      '2B.csv',
      '3A.csv',
      '3B.csv',
      '4A.csv',
      'Prima.csv',
      'Sekunda.csv',
      'Tercie.csv',
      'trida.csv',
    ];
  }

  // 3. Fetch and parse each CSV
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

    for (const p of possiblePaths) {
      try {
        const res = await fetch(p, { method: 'GET', cache: 'no-cache' });
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
