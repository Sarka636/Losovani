import { ClassItem, Student, ClassWithStudents } from '../types';
import {
  exportClassesToXlsxBlob,
  fetchDefaultClassesFromRepo,
  fetchPublicCsvClasses,
  parseAllSheetsWorkbook,
} from '../utils/fileParser';

const STORAGE_CLASSES_KEY = 'losovatko_storage_classes_v2';
const STORAGE_STUDENTS_KEY = 'losovatko_storage_students_v2';
const STORAGE_INIT_KEY = 'losovatko_initialized_from_xlsx';
const STORAGE_DELETED_CLASSES_KEY = 'losovatko_deleted_class_names_v1';

export function getDeletedClassNames(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_CLASSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedClassName(name: string): void {
  const current = getDeletedClassNames();
  if (!current.some((n) => n.toLowerCase() === name.toLowerCase())) {
    current.push(name);
    localStorage.setItem(STORAGE_DELETED_CLASSES_KEY, JSON.stringify(current));
  }
}

export function clearDeletedClassNames(): void {
  localStorage.removeItem(STORAGE_DELETED_CLASSES_KEY);
}

interface StoredClass {
  id: number;
  name: string;
  created_at: string;
}

interface StoredStudent {
  id: number;
  class_id: number;
  name: string;
  is_active: number;
}

// Check if backend API is reachable
let isBackendAvailable: boolean | null = null;
let backendCheckPromise: Promise<boolean> | null = null;

function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.includes('github.io') ||
    window.location.protocol === 'file:' ||
    window.location.hostname.includes('pages.dev')
  );
}

async function checkBackend(): Promise<boolean> {
  if (isBackendAvailable !== null) return isBackendAvailable;
  if (isStaticHosting()) {
    isBackendAvailable = false;
    return false;
  }
  if (backendCheckPromise) return backendCheckPromise;

  backendCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/classes', {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          isBackendAvailable = true;
          return true;
        }
      }
      isBackendAvailable = false;
      return false;
    } catch {
      isBackendAvailable = false;
      return false;
    } finally {
      backendCheckPromise = null;
    }
  })();

  return backendCheckPromise;
}

// Local storage helpers
function getLocalStoredClasses(): StoredClass[] {
  try {
    const raw = localStorage.getItem(STORAGE_CLASSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalStoredClasses(classes: StoredClass[]): void {
  localStorage.setItem(STORAGE_CLASSES_KEY, JSON.stringify(classes));
}

function getLocalStoredStudents(): StoredStudent[] {
  try {
    const raw = localStorage.getItem(STORAGE_STUDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalStoredStudents(students: StoredStudent[]): void {
  localStorage.setItem(STORAGE_STUDENTS_KEY, JSON.stringify(students));
}

function computeClassItems(classes: StoredClass[], students: StoredStudent[]): ClassItem[] {
  return classes.map((c) => {
    const classStudents = students.filter((s) => s.class_id === c.id);
    const active = classStudents.filter((s) => s.is_active === 1).length;
    return {
      id: c.id,
      name: c.name,
      created_at: c.created_at,
      total_students: classStudents.length,
      active_students: active,
    };
  });
}

/**
 * Automatically syncs classes from public/*.csv files.
 * The class name is the file name without .csv.
 */
export async function syncPublicCsvClasses(force = false): Promise<ClassItem[]> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      const res = await fetch('/api/classes/sync-public-csvs', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.classes && Array.isArray(data.classes)) {
          return data.classes;
        }
      }
    } catch (err) {
      console.warn('Backend CSV sync failed, falling back to client-side:', err);
    }
  }

  // Client-side static / localStorage sync
  try {
    const csvClasses = await fetchPublicCsvClasses();
    if (csvClasses && csvClasses.length > 0) {
      const deletedNames = force ? [] : getDeletedClassNames().map((n) => n.toLowerCase());
      const currentClasses = getLocalStoredClasses();
      const currentStudents = getLocalStoredStudents();

      let nextClassId = Date.now();
      let nextStudentId = Date.now() + 1000;
      let hasChanges = false;

      for (const csvClass of csvClasses) {
        const lowerName = csvClass.className.toLowerCase();
        if (!force && deletedNames.includes(lowerName)) {
          continue; // Skipped because user explicitly deleted it
        }

        const existing = currentClasses.find((c) => c.name.toLowerCase() === lowerName);
        if (!existing) {
          const classId = nextClassId++;
          currentClasses.push({
            id: classId,
            name: csvClass.className,
            created_at: new Date().toISOString(),
          });
          for (const sName of csvClass.names) {
            currentStudents.push({
              id: nextStudentId++,
              class_id: classId,
              name: sName,
              is_active: 1,
            });
          }
          hasChanges = true;
        } else {
          // If class exists but has 0 students in storage, populate from CSV
          const classStudents = currentStudents.filter((s) => s.class_id === existing.id);
          if (classStudents.length === 0) {
            for (const sName of csvClass.names) {
              currentStudents.push({
                id: nextStudentId++,
                class_id: existing.id,
                name: sName,
                is_active: 1,
              });
            }
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        setLocalStoredClasses(currentClasses);
        setLocalStoredStudents(currentStudents);
      }
    }
  } catch (err) {
    console.warn('Client CSV sync warning:', err);
  }

  const classes = getLocalStoredClasses();
  const students = getLocalStoredStudents();
  return computeClassItems(classes, students);
}

/**
 * Initializes data from public CSV files (or public/tridy.xlsx) if localStorage is empty
 */
export async function initializeStorageIfEmpty(): Promise<boolean> {
  const isInitialized = localStorage.getItem(STORAGE_INIT_KEY);
  const existingClasses = getLocalStoredClasses();

  // If user already has classes or initialized, still sync any newly added public CSV files
  if (isInitialized || existingClasses.length > 0) {
    await syncPublicCsvClasses(false);
    return false;
  }

  // Mark that initial attempt was performed
  localStorage.setItem(STORAGE_INIT_KEY, 'true');

  // 1. Primary: Load all CSV files from public/ (filename = class name)
  try {
    const csvClasses = await fetchPublicCsvClasses();
    if (csvClasses && csvClasses.length > 0) {
      await loadFromParsedSheets(csvClasses);
      return true;
    }
  } catch (err) {
    console.warn('Could not auto-load CSV classes from public:', err);
  }

  // 2. Secondary: Fallback to tridy.xlsx if no CSV files
  try {
    const fromRepo = await fetchDefaultClassesFromRepo();
    if (fromRepo && fromRepo.length > 0) {
      await loadFromParsedSheets(fromRepo);
      return true;
    }
  } catch (err) {
    console.warn('Could not load default classes from tridy.xlsx:', err);
  }

  // 3. Fallback initial sample class if nothing else found
  const sampleClass: StoredClass = {
    id: 1,
    name: '1.A',
    created_at: new Date().toISOString(),
  };
  const sampleStudents: StoredStudent[] = [
    'Tereza Černá',
    'Adam Dvořák',
    'Filip Horák',
    'Eliška Kučerová',
    'Jan Pospíšil',
    'David Svoboda',
  ].map((name, idx) => ({
    id: idx + 1,
    class_id: 1,
    name,
    is_active: 1,
  }));

  setLocalStoredClasses([sampleClass]);
  setLocalStoredStudents(sampleStudents);
  return true;
}

/**
 * Loads classes and students from an array of parsed sheets (each sheet = class)
 */
export async function loadFromParsedSheets(
  sheets: { className: string; names: string[] }[]
): Promise<number> {
  const newClasses: StoredClass[] = [];
  const newStudents: StoredStudent[] = [];

  let nextClassId = Date.now();
  let nextStudentId = Date.now() + 1000;

  for (const sheet of sheets) {
    const classId = nextClassId++;
    newClasses.push({
      id: classId,
      name: sheet.className,
      created_at: new Date().toISOString(),
    });

    for (const name of sheet.names) {
      newStudents.push({
        id: nextStudentId++,
        class_id: classId,
        name,
        is_active: 1,
      });
    }
  }

  setLocalStoredClasses(newClasses);
  setLocalStoredStudents(newStudents);
  return newClasses.length;
}

/**
 * Re-syncs / reloads classes from public CSV files or public/tridy.xlsx
 */
export async function reloadFromGitHubXlsx(): Promise<{ count: number; classNames: string[] }> {
  clearDeletedClassNames();

  // 1. Try public CSV files first
  try {
    const csvClasses = await fetchPublicCsvClasses();
    if (csvClasses && csvClasses.length > 0) {
      const updatedClasses = await syncPublicCsvClasses(true);
      return {
        count: csvClasses.length,
        classNames: csvClasses.map((s) => s.className),
      };
    }
  } catch (err) {
    console.warn('Could not reload from public CSVs:', err);
  }

  // 2. Fallback to tridy.xlsx
  const fromRepo = await fetchDefaultClassesFromRepo();
  if (fromRepo && fromRepo.length > 0) {
    await loadFromParsedSheets(fromRepo);
    return {
      count: fromRepo.length,
      classNames: fromRepo.map((s) => s.className),
    };
  }

  throw new Error('V adresáři public nebyly nalezeny žádné CSV soubory ani soubor tridy.xlsx.');
}

/**
 * Get list of all classes
 */
export async function fetchClasses(): Promise<ClassItem[]> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) {
        const data: ClassItem[] = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // fallback
    }
  }

  await initializeStorageIfEmpty();
  const classes = getLocalStoredClasses();
  const students = getLocalStoredStudents();
  return computeClassItems(classes, students);
}

/**
 * Get students for a specific class
 */
export async function fetchStudentsForClass(classId: number): Promise<Student[]> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      const res = await fetch(`/api/classes/${classId}/students`);
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }
  }

  const allStudents = getLocalStoredStudents();
  return allStudents.filter((s) => s.class_id === classId);
}

/**
 * Create a new empty class
 */
export async function createClass(name: string): Promise<ClassItem> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }
  }

  const classes = getLocalStoredClasses();
  const newClass: StoredClass = {
    id: Date.now(),
    name,
    created_at: new Date().toISOString(),
  };
  classes.push(newClass);
  setLocalStoredClasses(classes);

  return {
    id: newClass.id,
    name: newClass.name,
    created_at: newClass.created_at,
    total_students: 0,
    active_students: 0,
  };
}

/**
 * Rename a class
 */
export async function renameClass(classId: number, newName: string): Promise<void> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      await fetch(`/api/classes/${classId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
    } catch {
      // fallback
    }
  }

  const classes = getLocalStoredClasses();
  const updated = classes.map((c) => (c.id === classId ? { ...c, name: newName } : c));
  setLocalStoredClasses(updated);
}

/**
 * Delete a class and all its students
 */
export async function deleteClass(classId: number): Promise<void> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Chyba při mazání třídy ze serveru');
      }
    } catch (err) {
      console.warn('Backend delete class warning, updating local state:', err);
    }
  }

  const numId = Number(classId);
  const classToDelete = getLocalStoredClasses().find((c) => Number(c.id) === numId);
  if (classToDelete) {
    addDeletedClassName(classToDelete.name);
  }
  const classes = getLocalStoredClasses().filter((c) => Number(c.id) !== numId);
  const students = getLocalStoredStudents().filter((s) => Number(s.class_id) !== numId);
  setLocalStoredClasses(classes);
  setLocalStoredStudents(students);
}

/**
 * Add a student to a class
 */
export async function addStudent(classId: number, name: string): Promise<Student> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      const res = await fetch(`/api/classes/${classId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }
  }

  const students = getLocalStoredStudents();
  const newStudent: StoredStudent = {
    id: Date.now(),
    class_id: classId,
    name,
    is_active: 1,
  };
  students.push(newStudent);
  setLocalStoredStudents(students);
  return newStudent;
}

/**
 * Toggle student active/inactive status
 */
export async function toggleStudentActive(studentId: number, isActive: number): Promise<void> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      await fetch(`/api/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });
    } catch {
      // fallback
    }
  }

  const students = getLocalStoredStudents();
  const updated = students.map((s) => (s.id === studentId ? { ...s, is_active: isActive } : s));
  setLocalStoredStudents(updated);
}

/**
 * Delete a student
 */
export async function deleteStudent(studentId: number): Promise<void> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
    } catch {
      // fallback
    }
  }

  const students = getLocalStoredStudents().filter((s) => s.id !== studentId);
  setLocalStoredStudents(students);
}

/**
 * Reset all students to active in a class
 */
export async function resetAllActiveInClass(classId: number): Promise<void> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      await fetch(`/api/classes/${classId}/reset-active`, { method: 'PATCH' });
    } catch {
      // fallback
    }
  }

  const students = getLocalStoredStudents();
  const updated = students.map((s) => (s.class_id === classId ? { ...s, is_active: 1 } : s));
  setLocalStoredStudents(updated);
}

/**
 * Toggle all students in a class
 */
export async function toggleAllInClass(classId: number, isActive: number): Promise<void> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      await fetch(`/api/classes/${classId}/toggle-all`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });
    } catch {
      // fallback
    }
  }

  const students = getLocalStoredStudents();
  const updated = students.map((s) => (s.class_id === classId ? { ...s, is_active: isActive } : s));
  setLocalStoredStudents(updated);
}

/**
 * Import a new class with students
 */
export async function importNewClass(
  className: string,
  studentNames: string[]
): Promise<ClassItem> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      const res = await fetch('/api/classes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, students: studentNames }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          id: data.classId,
          name: className,
          created_at: new Date().toISOString(),
          total_students: studentNames.length,
          active_students: studentNames.length,
        };
      }
    } catch {
      // fallback
    }
  }

  const classes = getLocalStoredClasses();
  const students = getLocalStoredStudents();

  const newClassId = Date.now();
  const newClass: StoredClass = {
    id: newClassId,
    name: className,
    created_at: new Date().toISOString(),
  };
  classes.push(newClass);

  let nextStudentId = Date.now() + 500;
  for (const name of studentNames) {
    students.push({
      id: nextStudentId++,
      class_id: newClassId,
      name,
      is_active: 1,
    });
  }

  setLocalStoredClasses(classes);
  setLocalStoredStudents(students);

  return {
    id: newClassId,
    name: className,
    created_at: newClass.created_at,
    total_students: studentNames.length,
    active_students: studentNames.length,
  };
}

/**
 * Import students into an existing class
 */
export async function importToExistingClass(
  classId: number,
  studentNames: string[]
): Promise<void> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      await fetch(`/api/classes/${classId}/import-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: studentNames }),
      });
    } catch {
      // fallback
    }
  }

  const students = getLocalStoredStudents();
  let nextStudentId = Date.now();
  for (const name of studentNames) {
    students.push({
      id: nextStudentId++,
      class_id: classId,
      name,
      is_active: 1,
    });
  }
  setLocalStoredStudents(students);
}

/**
 * Exports all current classes and their students into a single multi-sheet XLSX Blob.
 * Each class will be on its own sheet named after the class.
 */
export async function exportAllClassesToMultiSheetXlsx(): Promise<Blob> {
  const classes = await fetchClasses();
  const classesData: ClassWithStudents[] = [];

  for (const c of classes) {
    const classStudents = await fetchStudentsForClass(c.id);
    classesData.push({
      name: c.name,
      students: classStudents.map((s) => s.name),
    });
  }

  return exportClassesToXlsxBlob(classesData);
}
