import { useState, useRef, DragEvent, ChangeEvent, FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Users,
  Trash2,
  FolderPlus,
  ArrowRight,
  ClipboardList,
  Sparkles,
  Layers,
} from 'lucide-react';
import { parseFileToStudentNames, SheetClassResult } from '../utils/fileParser';
import { ClassItem } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClass: ClassItem | null;
  onImportNewClass: (className: string, students: string[]) => Promise<void>;
  onImportToExistingClass: (classId: number, students: string[]) => Promise<void>;
  onImportMultipleClasses?: (classes: SheetClassResult[]) => Promise<void>;
}

export default function ImportModal({
  isOpen,
  onClose,
  currentClass,
  onImportNewClass,
  onImportToExistingClass,
  onImportMultipleClasses,
}: ImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [targetClassName, setTargetClassName] = useState('');
  const [detectedStudents, setDetectedStudents] = useState<string[]>([]);
  const [multiSheets, setMultiSheets] = useState<SheetClassResult[] | null>(null);
  const [importMode, setImportMode] = useState<'new' | 'existing'>('new');
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualText, setManualText] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    setErrorMsg('');
    setIsProcessing(true);
    setMultiSheets(null);
    try {
      setFileName(file.name);
      const { suggestedClassName, names, allSheets } = await parseFileToStudentNames(file);
      setDetectedStudents(names);
      setTargetClassName(suggestedClassName);
      if (allSheets && allSheets.length > 1) {
        setMultiSheets(allSheets);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nepodařilo se zpracovat soubor';
      setErrorMsg(msg);
      setDetectedStudents([]);
      setMultiSheets(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportAllMultiSheets = async () => {
    if (!multiSheets || !onImportMultipleClasses) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      await onImportMultipleClasses(multiSheets);
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Hromadný import se nezdařil';
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParseManualText = () => {
    setErrorMsg('');
    if (!manualText.trim()) return;

    const lines = manualText
      .split(/\r?\n/)
      .map((line) => line.replace(/^(\d+[\.\)\-:]\s*)+/, '').trim())
      .filter((line) => line.length > 0);

    const unique = Array.from(new Set(lines));
    if (unique.length === 0) {
      setErrorMsg('V zadaném textu nebyla nalezena žádná jména');
      return;
    }

    setDetectedStudents(unique);
    setMultiSheets(null);
    if (!targetClassName) {
      setTargetClassName('Nová třída');
    }
    setFileName('Ručně vložený seznam');
  };

  const handleRemoveStudent = (indexToRemove: number) => {
    setDetectedStudents((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (detectedStudents.length === 0) {
      setErrorMsg('Seznam studentů k importu je prázdný.');
      return;
    }

    setIsProcessing(true);
    try {
      if (importMode === 'new') {
        if (!targetClassName.trim()) {
          setErrorMsg('Zadejte prosím název pro novou třídu.');
          setIsProcessing(false);
          return;
        }
        await onImportNewClass(targetClassName.trim(), detectedStudents);
      } else if (importMode === 'existing' && currentClass) {
        await onImportToExistingClass(currentClass.id, detectedStudents);
      }
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import se nezdařil';
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setDetectedStudents([]);
    setMultiSheets(null);
    setFileName('');
    setTargetClassName('');
    setErrorMsg('');
    setManualText('');
    setShowManualPaste(false);
    onClose();
  };

  return (
    <div
      id="import-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs overflow-y-auto"
    >
      <motion.div
        id="import-modal-dialog"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-zinc-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div
              id="import-modal-header-icon"
              className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 id="import-modal-title" className="text-xl font-bold text-zinc-900">
                Nahrát seznam třídy (CSV)
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Třídy se primárně čtou automaticky ze souborů .csv v adresáři public/
              </p>
            </div>
          </div>
          <button
            id="btn-close-import-modal"
            type="button"
            onClick={handleClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5" id="import-form">
          {/* Error Banner */}
          {errorMsg && (
            <div
              id="import-error-banner"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Multi-sheet XLSX detected banner */}
          {multiSheets && multiSheets.length > 1 && onImportMultipleClasses && (
            <div
              id="multi-sheet-detected-card"
              className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Detekován sešit s více třídami ({multiSheets.length} listů)
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    Každý list odpovídá jedné třídě:{' '}
                    <strong>
                      {multiSheets.map((s) => `${s.className} (${s.names.length})`).join(', ')}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                id="btn-import-all-multi-sheets"
                type="button"
                onClick={handleImportAllMultiSheets}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Importovat všech {multiSheets.length} tříd najednou</span>
              </button>
            </div>
          )}

          {/* Mode selector if current class exists */}
          {currentClass && detectedStudents.length > 0 && !multiSheets && (
            <div className="bg-zinc-100/70 p-1 rounded-2xl flex gap-1 text-sm font-semibold" id="import-mode-tabs">
              <button
                id="btn-mode-new-class"
                type="button"
                onClick={() => setImportMode('new')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  importMode === 'new'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <FolderPlus className="w-4 h-4" />
                Vytvořit jako novou třídu
              </button>
              <button
                id="btn-mode-existing-class"
                type="button"
                onClick={() => setImportMode('existing')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  importMode === 'existing'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Users className="w-4 h-4" />
                Přidat do: {currentClass.name}
              </button>
            </div>
          )}

          {/* Drag & Drop File Upload Area */}
          {!showManualPaste ? (
            <div>
              <input
                ref={fileInputRef}
                id="file-upload-input"
                type="file"
                accept=".csv, .xlsx, .xls, .tsv, .txt, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                id="drag-drop-zone"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01]'
                    : 'border-zinc-300 hover:border-emerald-500 hover:bg-zinc-50/80 bg-zinc-50/40'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shadow-xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-800">
                      Přetáhněte sem soubor se studenty nebo{' '}
                      <span className="text-emerald-700 underline font-semibold">
                        vyberte z počítače
                      </span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      Podporuje soubory .csv (jedno jméno na řádek), Bakaláře i textové seznamy
                    </p>
                  </div>
                  {fileName && (
                    <div
                      id="selected-file-chip"
                      className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-zinc-200 rounded-full text-xs font-semibold text-zinc-700 shadow-2xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="truncate max-w-[240px]">{fileName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 text-right">
                <button
                  id="btn-toggle-manual-paste"
                  type="button"
                  onClick={() => setShowManualPaste(true)}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Nebo vložit seznam zkopírováním textu
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2" id="manual-paste-section">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="manual-text-input"
                  className="text-xs font-bold text-zinc-700"
                >
                  Vložte seznam studentů (jedno jméno na řádek):
                </label>
                <button
                  id="btn-back-to-file-upload"
                  type="button"
                  onClick={() => setShowManualPaste(false)}
                  className="text-xs text-emerald-700 hover:underline cursor-pointer"
                >
                  Zpět na nahrání souboru
                </button>
              </div>
              <textarea
                id="manual-text-input"
                rows={5}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="1. Jan Novák&#10;2. Marie Svobodová&#10;3. Petr Černý..."
                className="w-full p-3 text-sm bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <button
                id="btn-parse-manual-text"
                type="button"
                onClick={handleParseManualText}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Načíst jména z textu
              </button>
            </div>
          )}

          {/* New Class Name Input (if mode is 'new' and not bulk-importing all sheets) */}
          {importMode === 'new' && detectedStudents.length > 0 && !multiSheets && (
            <div className="space-y-1.5" id="target-class-name-container">
              <label
                htmlFor="input-target-class-name"
                className="text-xs font-bold text-zinc-700 tracking-wide"
              >
                Název nové třídy:
              </label>
              <input
                id="input-target-class-name"
                type="text"
                required
                value={targetClassName}
                onChange={(e) => setTargetClassName(e.target.value)}
                placeholder="Např. 3.A, Kvinta, Dějepis..."
                className="w-full px-4 py-2.5 bg-white border border-zinc-300 rounded-2xl font-medium text-zinc-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <p className="text-xs text-zinc-400">
                Pod tímto názvem se třída uloží a zůstane v aplikaci dostupná kdykoli pro další losování.
              </p>
            </div>
          )}

          {/* Student Names Preview */}
          {detectedStudents.length > 0 && (
            <div className="space-y-2" id="detected-students-preview-block">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Nalezeno {detectedStudents.length} studentů:
                </span>
                <span className="text-[11px] text-zinc-400">
                  (Kliknutím na křížek studenta odeberete)
                </span>
              </div>

              <div
                id="detected-students-chips-container"
                className="max-h-40 overflow-y-auto p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 flex flex-wrap gap-1.5"
              >
                {detectedStudents.map((name, idx) => (
                  <span
                    key={`${name}-${idx}`}
                    id={`detected-student-chip-${idx}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-800 shadow-2xs group hover:border-rose-300"
                  >
                    <span>{name}</span>
                    <button
                      id={`btn-remove-detected-student-${idx}`}
                      type="button"
                      onClick={() => handleRemoveStudent(idx)}
                      className="text-zinc-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                      title="Odebrat z importu"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-100" id="import-modal-footer">
            <button
              id="btn-cancel-import-modal"
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
            >
              Zrušit
            </button>
            <button
              id="btn-submit-import-students"
              type="submit"
              disabled={detectedStudents.length === 0 || isProcessing}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                detectedStudents.length === 0 || isProcessing
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <span>{isProcessing ? 'Ukládám...' : 'Importovat studenty'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
