import { useState, FormEvent, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap,
  ChevronDown,
  Plus,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Check,
  X,
  Users,
  Download,
  RefreshCw,
} from 'lucide-react';
import { ClassItem } from '../types';

interface ClassSelectorProps {
  classes: ClassItem[];
  selectedClassId: number | null;
  onSelectClass: (id: number) => void;
  onCreateClass: (name: string) => Promise<void>;
  onRenameClass: (id: number, newName: string) => Promise<void>;
  onDeleteClass: (id: number) => Promise<void>;
  onOpenImport: () => void;
  onOpenExport?: () => void;
  onReloadFromGitHub?: () => void;
}

export default function ClassSelector({
  classes,
  selectedClassId,
  onSelectClass,
  onCreateClass,
  onRenameClass,
  onDeleteClass,
  onOpenImport,
  onOpenExport,
  onReloadFromGitHub,
}: ClassSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editingClassName, setEditingClassName] = useState('');
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);

  const currentClass = classes.find((c) => c.id === selectedClassId) || (classes.length > 0 ? classes[0] : null);

  const handleStartCreate = () => {
    setIsCreating(true);
    setNewClassName('');
  };

  const handleConfirmCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    await onCreateClass(newClassName.trim());
    setNewClassName('');
    setIsCreating(false);
    setIsOpen(false);
  };

  const handleStartRename = (cls: ClassItem, e: MouseEvent) => {
    e.stopPropagation();
    setEditingClassId(cls.id);
    setEditingClassName(cls.name);
  };

  const handleConfirmRename = async (id: number, e: FormEvent) => {
    e.preventDefault();
    if (!editingClassName.trim()) return;
    await onRenameClass(id, editingClassName.trim());
    setEditingClassId(null);
  };

  return (
    <div className="relative w-full" id="class-selector-container">
      {/* Selector trigger bar */}
      <div
        id="class-selector-bar"
        className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-zinc-200/90 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            id="class-badge-icon"
            className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100"
          >
            <GraduationCap className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="text-xs text-zinc-500 font-medium tracking-wide">
              Vybraná třída
            </div>
            <button
              id="class-dropdown-trigger-btn"
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 text-left font-bold text-zinc-900 text-lg hover:text-emerald-600 transition-colors group cursor-pointer focus:outline-hidden"
            >
              <span className="truncate max-w-[200px] sm:max-w-xs">
                {currentClass ? currentClass.name : 'Žádná třída'}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-zinc-400 group-hover:text-emerald-600 transition-transform duration-200 shrink-0 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Quick info & action buttons */}
        <div className="flex items-center gap-2 shrink-0 ml-auto" id="class-quick-actions">
          {currentClass && (
            <div
              id="class-active-count-chip"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100/80 rounded-xl text-xs font-semibold text-zinc-700"
            >
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span>
                {currentClass.active_students}/{currentClass.total_students} aktivních
              </span>
            </div>
          )}

          <button
            id="open-import-modal-btn"
            type="button"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold border border-emerald-200/80 transition-colors shadow-2xs cursor-pointer"
            title="Nahrát seznam studentů ze souboru CSV nebo Excel (XLSX)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span className="hidden sm:inline">Nahrát ze souboru</span>
            <span className="sm:hidden">Import</span>
          </button>

          {onOpenExport && (
            <button
              id="open-export-modal-btn"
              type="button"
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-zinc-100 text-zinc-800 rounded-xl text-sm font-semibold border border-zinc-200/90 transition-colors shadow-2xs cursor-pointer"
              title="Exportovat všechny třídy do jednoho souboru tridy.xlsx (každá třída na samostatném listu) pro GitHub Pages"
            >
              <Download className="w-4 h-4 text-zinc-600" />
              <span className="hidden md:inline">Export pro GitHub</span>
              <span className="md:hidden">Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              id="class-dropdown-backdrop"
              className="fixed inset-0 z-20"
              onClick={() => {
                setIsOpen(false);
                setIsCreating(false);
                setEditingClassId(null);
              }}
            />
            <motion.div
              id="class-dropdown-menu"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden"
            >
              <div className="p-3 border-b border-zinc-100 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 tracking-wider">
                  VŠECHNY TŘÍDY ({classes.length})
                </span>
                <button
                  id="dropdown-upload-shortcut-btn"
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenImport();
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Nahrát novou třídu
                </button>
              </div>

              {/* Class List */}
              <div className="max-h-72 overflow-y-auto p-2 space-y-1" id="class-dropdown-list">
                {classes.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    Nemáte žádnou třídu. Vytvořte novou níže nebo nahrajte soubor.
                  </div>
                ) : (
                  classes.map((cls) => (
                    <div
                      key={cls.id}
                      id={`class-item-${cls.id}`}
                      onClick={() => {
                        if (editingClassId !== cls.id) {
                          onSelectClass(cls.id);
                          setIsOpen(false);
                        }
                      }}
                      className={`group flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                        cls.id === selectedClassId
                          ? 'bg-emerald-50/80 text-emerald-950 font-semibold'
                          : 'hover:bg-zinc-100 text-zinc-800 font-medium'
                      }`}
                    >
                      {editingClassId === cls.id ? (
                        <form
                          onSubmit={(e) => handleConfirmRename(cls.id, e)}
                          className="flex items-center gap-2 flex-1 mr-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            id={`input-rename-class-${cls.id}`}
                            type="text"
                            value={editingClassName}
                            onChange={(e) => setEditingClassName(e.target.value)}
                            autoFocus
                            className="flex-1 px-2 py-1 text-sm bg-white border border-emerald-500 rounded-lg focus:outline-hidden"
                          />
                          <button
                            id={`btn-save-rename-${cls.id}`}
                            type="submit"
                            className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-md cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-cancel-rename-${cls.id}`}
                            type="button"
                            onClick={() => setEditingClassId(null)}
                            className="p-1 text-zinc-400 hover:bg-zinc-200 rounded-md cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                cls.id === selectedClassId ? 'bg-emerald-600' : 'bg-zinc-300'
                              }`}
                            />
                            <span className="truncate">{cls.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-normal shrink-0">
                              {cls.total_students} studentů
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              id={`btn-rename-class-${cls.id}`}
                              type="button"
                              onClick={(e) => handleStartRename(cls, e)}
                              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 rounded-md transition-colors cursor-pointer"
                              title="Přejmenovat třídu"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`btn-delete-class-${cls.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setClassToDelete(cls);
                              }}
                              className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Smazat třídu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add class directly inline */}
              <div className="p-3 bg-zinc-50 border-t border-zinc-100">
                {isCreating ? (
                  <form onSubmit={handleConfirmCreate} className="flex gap-2">
                    <input
                      id="input-inline-new-class-name"
                      type="text"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="Např. 2.B nebo Dějepis"
                      autoFocus
                      className="flex-1 px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <button
                      id="btn-inline-submit-new-class"
                      type="submit"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Uložit
                    </button>
                    <button
                      id="btn-inline-cancel-new-class"
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-2 py-1.5 text-zinc-500 hover:bg-zinc-200 rounded-xl text-xs cursor-pointer"
                    >
                      Zrušit
                    </button>
                  </form>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      id="btn-show-create-class-form"
                      type="button"
                      onClick={handleStartCreate}
                      className="w-full py-2 px-3 text-xs text-zinc-700 hover:text-emerald-700 hover:bg-zinc-100/80 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Vytvořit novou prázdnou třídu
                    </button>

                    <div className="pt-1.5 border-t border-zinc-200/60 flex items-center justify-between gap-1 text-xs">
                      {onOpenExport && (
                        <button
                          id="btn-dropdown-export-xlsx"
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onOpenExport();
                          }}
                          className="flex-1 py-1.5 px-2 text-zinc-600 hover:text-emerald-800 hover:bg-zinc-100 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Export pro GitHub</span>
                        </button>
                      )}

                      {onReloadFromGitHub && (
                        <button
                          id="btn-dropdown-reload-xlsx"
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onReloadFromGitHub();
                          }}
                          className="flex-1 py-1.5 px-2 text-zinc-600 hover:text-emerald-800 hover:bg-zinc-100 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer"
                          title="Znovu načte třídy ze souborů CSV v adresáři public (nebo z tridy.xlsx)"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Načíst z public CSV</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for deleting class */}
      {classToDelete && (
        <div
          id="delete-class-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setClassToDelete(null)}
        >
          <div
            id="delete-class-modal"
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-zinc-900">
                Smazat třídu {classToDelete.name}?
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Opravdu si přejete smazat třídu <strong>„{classToDelete.name}“</strong> včetně všech jejích studentů ({classToDelete.total_students})? Tuto akci nelze vzít zpět.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                id="btn-cancel-delete-class"
                type="button"
                onClick={() => setClassToDelete(null)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer"
              >
                Zrušit
              </button>
              <button
                id="btn-confirm-delete-class"
                type="button"
                onClick={async () => {
                  const id = classToDelete.id;
                  setClassToDelete(null);
                  setIsOpen(false);
                  await onDeleteClass(id);
                }}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Ano, smazat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
