import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react';
import ClassSelector from './components/ClassSelector';
import ImportModal from './components/ImportModal';
import ExportGitHubModal from './components/ExportGitHubModal';
import DrawingStage from './components/DrawingStage';
import StudentList from './components/StudentList';
import { ClassItem, Student } from './types';
import { downloadBlob, SheetClassResult } from './utils/fileParser';
import {
  fetchClasses as getClasses,
  fetchStudentsForClass,
  createClass as apiCreateClass,
  renameClass as apiRenameClass,
  deleteClass as apiDeleteClass,
  addStudent as apiAddStudent,
  toggleStudentActive as apiToggleStudentActive,
  deleteStudent as apiDeleteStudent,
  resetAllActiveInClass,
  toggleAllInClass,
  importNewClass as apiImportNewClass,
  importToExistingClass as apiImportToExistingClass,
  exportAllClassesToMultiSheetXlsx,
  reloadFromGitHubXlsx,
  loadFromParsedSheets,
} from './services/dataService';

const STORAGE_KEY_SELECTED_CLASS = 'losovatko_active_class_id';

export default function App() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SELECTED_CLASS);
    return saved ? Number(saved) : null;
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isReloadingGitHub, setIsReloadingGitHub] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch all classes
  const loadClasses = useCallback(async (targetIdToSelect?: number) => {
    try {
      setLoadingClasses(true);
      const data = await getClasses();
      setClasses(data);

      if (data.length > 0) {
        setSelectedClassId((prev) => {
          if (targetIdToSelect && data.some((c) => Number(c.id) === Number(targetIdToSelect))) {
            localStorage.setItem(STORAGE_KEY_SELECTED_CLASS, String(targetIdToSelect));
            return targetIdToSelect;
          }
          if (prev && data.some((c) => Number(c.id) === Number(prev))) {
            return prev;
          }
          const fallbackId = data[0].id;
          localStorage.setItem(STORAGE_KEY_SELECTED_CLASS, String(fallbackId));
          return fallbackId;
        });
      } else {
        setSelectedClassId(null);
        setStudents([]);
        localStorage.removeItem(STORAGE_KEY_SELECTED_CLASS);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  // Fetch students for the selected class
  const loadStudents = useCallback(async (classId: number) => {
    try {
      setLoadingStudents(true);
      const data = await fetchStudentsForClass(classId);
      setStudents(data);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // When selectedClassId changes, reload students
  useEffect(() => {
    if (selectedClassId) {
      localStorage.setItem(STORAGE_KEY_SELECTED_CLASS, String(selectedClassId));
      loadStudents(selectedClassId);
    } else {
      setStudents([]);
    }
  }, [selectedClassId, loadStudents]);

  const handleSelectClass = (id: number) => {
    setSelectedClassId(id);
    localStorage.setItem(STORAGE_KEY_SELECTED_CLASS, String(id));
  };

  const handleCreateClass = async (name: string) => {
    try {
      const newClass = await apiCreateClass(name);
      await loadClasses(newClass.id);
      showToast(`Třída ${name} byla vytvořena`);
    } catch (err) {
      console.error('Failed to create class:', err);
    }
  };

  const handleRenameClass = async (id: number, newName: string) => {
    try {
      await apiRenameClass(id, newName);
      await loadClasses(selectedClassId || undefined);
      showToast(`Třída přejmenována na ${newName}`);
    } catch (err) {
      console.error('Failed to rename class:', err);
    }
  };

  const handleDeleteClass = async (id: number) => {
    try {
      await apiDeleteClass(id);
      const remaining = classes.filter((c) => Number(c.id) !== Number(id));
      const nextId = remaining.length > 0 ? remaining[0].id : undefined;
      await loadClasses(nextId);
      if (remaining.length === 0) {
        setSelectedClassId(null);
        setStudents([]);
        localStorage.removeItem(STORAGE_KEY_SELECTED_CLASS);
      }
      showToast('Třída byla smazána');
    } catch (err: unknown) {
      console.error('Failed to delete class:', err);
      const msg = err instanceof Error ? err.message : 'Nepodařilo se smazat třídu';
      showToast(msg);
    }
  };

  const handleImportNewClass = async (className: string, studentNames: string[]) => {
    const newClass = await apiImportNewClass(className, studentNames);
    await loadClasses(newClass.id);
    showToast(`Třída ${className} (${studentNames.length} studentů) byla importována`);
  };

  const handleImportToExistingClass = async (classId: number, studentNames: string[]) => {
    await apiImportToExistingClass(classId, studentNames);
    if (selectedClassId) {
      await loadStudents(selectedClassId);
      await loadClasses(selectedClassId);
    }
    showToast(`Přidáno ${studentNames.length} studentů`);
  };

  const handleImportMultipleClasses = async (sheets: SheetClassResult[]) => {
    await loadFromParsedSheets(sheets);
    await loadClasses();
    showToast(`Úspěšně importováno ${sheets.length} tříd z Excelu`);
  };

  const handleAddStudent = async (name: string) => {
    if (!selectedClassId) return;
    try {
      await apiAddStudent(selectedClassId, name);
      await loadStudents(selectedClassId);
      await loadClasses(selectedClassId);
    } catch (err) {
      console.error('Failed to add student:', err);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: number) => {
    try {
      const nextStatus = currentStatus === 1 ? 0 : 1;
      await apiToggleStudentActive(id, nextStatus);
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: nextStatus } : s))
      );
      if (selectedClassId) {
        await loadClasses(selectedClassId);
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDeleteStudent = async (id: number) => {
    try {
      await apiDeleteStudent(id);
      if (selectedClassId) {
        setStudents((prev) => prev.filter((s) => s.id !== id));
        await loadClasses(selectedClassId);
      }
    } catch (err) {
      console.error('Failed to delete student:', err);
    }
  };

  const handleResetAllActive = async () => {
    if (!selectedClassId) return;
    try {
      await resetAllActiveInClass(selectedClassId);
      setStudents((prev) => prev.map((s) => ({ ...s, is_active: 1 })));
      await loadClasses(selectedClassId);
    } catch (err) {
      console.error('Failed to reset students:', err);
    }
  };

  const handleToggleAll = async (is_active: number) => {
    if (!selectedClassId) return;
    try {
      await toggleAllInClass(selectedClassId, is_active);
      setStudents((prev) => prev.map((s) => ({ ...s, is_active })));
      await loadClasses(selectedClassId);
    } catch (err) {
      console.error('Failed to toggle all students:', err);
    }
  };

  // Export to multi-sheet tridy.xlsx for GitHub Pages
  const handleExportXlsxForGitHub = async () => {
    try {
      const blob = await exportAllClassesToMultiSheetXlsx();
      downloadBlob(blob, 'tridy.xlsx');
      setIsExportModalOpen(true);
    } catch (err) {
      console.error('Failed to export XLSX:', err);
      showToast('Nepodařilo se vygenerovat export');
    }
  };

  // Re-sync from GitHub public/tridy.xlsx
  const handleReloadFromGitHub = async () => {
    setIsReloadingGitHub(true);
    try {
      const result = await reloadFromGitHubXlsx();
      await loadClasses();
      showToast(`Načteno ${result.count} tříd ze souboru tridy.xlsx`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nepodařilo se načíst soubor z GitHubu';
      showToast(msg);
    } finally {
      setIsReloadingGitHub(false);
    }
  };

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0] || null;

  return (
    <div className="min-h-screen bg-zinc-50/70 text-zinc-900 pb-16 antialiased" id="losovatko-root-app">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="toast-notification"
          className="fixed bottom-5 right-5 z-50 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-zinc-800 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-zinc-200/80" id="main-app-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              id="app-brand-logo"
              className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-xs"
            >
              L
            </div>
            <div>
              <h1 id="app-brand-title" className="text-lg font-bold tracking-tight text-zinc-900 leading-none">
                Losovátko
              </h1>
              <span className="text-[11px] font-medium text-emerald-700">
                Výběr studentů pro školy
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-header-export-github"
              type="button"
              onClick={handleExportXlsxForGitHub}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:text-emerald-900 bg-white hover:bg-zinc-100 border border-zinc-200/90 rounded-xl transition-colors cursor-pointer shadow-2xs"
              title="Exportovat všechny třídy do souboru tridy.xlsx pro GitHub Pages"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export pro GitHub (.xlsx)</span>
              <span className="sm:hidden">Export</span>
            </button>

            <button
              id="btn-header-quick-import"
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Nahrát třídu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6" id="main-content-layout">
        {/* Class Selector Bar */}
        <section id="section-class-selector">
          <ClassSelector
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClass={handleSelectClass}
            onCreateClass={handleCreateClass}
            onRenameClass={handleRenameClass}
            onDeleteClass={handleDeleteClass}
            onOpenImport={() => setIsImportModalOpen(true)}
            onOpenExport={handleExportXlsxForGitHub}
            onReloadFromGitHub={handleReloadFromGitHub}
          />
        </section>

        {/* Two-Column Grid: Left is Roster & Management, Right is Drawing Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="app-workspace-grid">
          {/* Left Column: Student Roster & Add Student */}
          <section className="lg:col-span-5 order-2 lg:order-1" id="section-student-roster">
            {currentClass ? (
              <StudentList
                currentClass={currentClass}
                students={students}
                loading={loadingStudents}
                onAddStudent={handleAddStudent}
                onToggleActive={handleToggleActive}
                onDeleteStudent={handleDeleteStudent}
                onResetAllActive={handleResetAllActive}
                onToggleAll={handleToggleAll}
                onOpenImport={() => setIsImportModalOpen(true)}
              />
            ) : (
              <div className="bg-white rounded-3xl p-8 text-center border border-zinc-200/90 shadow-xs space-y-4" id="no-class-placeholder">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-100">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-900">Nemáte žádnou třídu</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                    Vytvořte novou třídu tlačítkem nahoře, nahrajte studenty ze souboru nebo načtěte ukázkový soubor.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    id="btn-empty-import-class"
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors"
                  >
                    Nahrát třídu ze souboru
                  </button>
                  <button
                    id="btn-empty-reload-sample"
                    type="button"
                    onClick={handleReloadFromGitHub}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    Načíst ukázkové třídy
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Right Column: Drawing Stage & Explainer */}
          <section className="lg:col-span-7 order-1 lg:order-2 space-y-6 sticky lg:top-20" id="section-drawing-stage">
            {currentClass ? (
              <DrawingStage
                classNameTitle={currentClass.name}
                students={students}
                onToggleActive={handleToggleActive}
                onResetAllActive={handleResetAllActive}
              />
            ) : (
              <div className="bg-zinc-900 text-white rounded-3xl p-8 text-center shadow-xl space-y-3 border border-zinc-800" id="no-class-drawing-placeholder">
                <h3 className="text-base font-bold text-zinc-100">Připraveno k losování</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Pro spuštění losovátka nejdříve vytvořte nebo nahrajte třídu v levém panelu.
                </p>
              </div>
            )}

            {/* Guide Card */}
            <div
              id="quick-guide-card"
              className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200/90 shadow-xs"
            >
              <h3 className="text-sm font-bold text-zinc-900 mb-2 flex items-center gap-2" id="guide-title">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                Jak používat Losovátko s více třídami a na GitHub Pages?
              </h3>
              <ul className="text-xs text-zinc-600 space-y-2.5 leading-relaxed" id="guide-list">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span>
                    <strong>Všechny třídy v jednom Excelu:</strong> Klikněte na <strong>Export pro GitHub (.xlsx)</strong>. Aplikace vygeneruje a stáhne soubor <code>tridy.xlsx</code>, kde je každá třída na samostatném listu (záložce).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>
                    <strong>Automatické načtení na GitHub Pages:</strong> Stažený soubor <code>tridy.xlsx</code> nahrajte do složky <code>public/</code> ve svém GitHub repozitáři. Na libovolném počítači i mobilu se pak třídy načtou automaticky při spuštění.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <span>
                    <strong>Jednotlivec nebo dvojice:</strong> Přepínačem v tmavém losovacím panelu můžete volit mezi vylosováním jednoho studenta (pro zkoušení) nebo dvojice (pro týmovou práci a dialogy).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    4
                  </span>
                  <span>
                    <strong>Vyškrtávání studentů:</strong> Kliknutím na studenta v seznamu ho můžete dočasně vyškrtnout (nepřítomen, už zkoušený). Po vylosování lze studenta (nebo celou dvojici) vyškrtnout jedním kliknutím přímo pod výsledkem.
                  </span>
                </li>
                <li className="flex items-start gap-2 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60 text-amber-900">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    5
                  </span>
                  <span>
                    <strong>Proč se po exportu na GitHub může zobrazit prázdná stránka?</strong> Na GitHubu v <strong>Settings ⚙️ &rarr; Pages</strong> v sekci <em>Build and deployment</em> přepněte <strong>Source</strong> na <strong>GitHub Actions</strong> (místo „Deploy from a branch“). Repozitář má připravený skript <code>deploy.yml</code>, který aplikaci automaticky zkompiluje a zprovozní.
                  </span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </main>

      {/* Import CSV/XLSX Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentClass={currentClass}
        onImportNewClass={handleImportNewClass}
        onImportToExistingClass={handleImportToExistingClass}
        onImportMultipleClasses={handleImportMultipleClasses}
      />

      {/* Export for GitHub Modal */}
      <ExportGitHubModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        classes={classes}
        onDownloadAgain={handleExportXlsxForGitHub}
        onReloadFromGitHub={handleReloadFromGitHub}
        isReloading={isReloadingGitHub}
      />
    </div>
  );
}
