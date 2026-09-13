import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserPlus,
  Trash2,
  CheckCircle2,
  Circle,
  Search,
  CheckCheck,
  Ban,
  FileSpreadsheet,
} from 'lucide-react';
import { Student, ClassItem } from '../types';

interface StudentListProps {
  currentClass: ClassItem;
  students: Student[];
  loading: boolean;
  onAddStudent: (name: string) => Promise<void>;
  onToggleActive: (id: number, currentStatus: number) => Promise<void>;
  onDeleteStudent: (id: number) => Promise<void>;
  onResetAllActive: () => Promise<void>;
  onToggleAll: (is_active: number) => Promise<void>;
  onOpenImport: () => void;
}

export default function StudentList({
  currentClass,
  students,
  loading,
  onAddStudent,
  onToggleActive,
  onDeleteStudent,
  onResetAllActive,
  onToggleAll,
  onOpenImport,
}: StudentListProps) {
  const [newStudentName, setNewStudentName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const activeCount = students.filter((s) => s.is_active === 1).length;

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    await onAddStudent(newStudentName.trim());
    setNewStudentName('');
  };

  return (
    <div className="space-y-6" id="student-list-container">
      {/* Add Student Box */}
      <div
        id="add-student-card"
        className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-zinc-200"
      >
        <h2 className="text-base font-bold text-zinc-900 mb-3 flex items-center gap-2" id="add-student-title">
          <UserPlus className="w-4 h-4 text-emerald-600" />
          Přidat studenta do třídy {currentClass.name}
        </h2>

        <form onSubmit={handleAddSubmit} className="flex gap-2" id="form-add-student">
          <input
            id="input-new-student-name"
            type="text"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            placeholder="Jméno a příjmení studenta..."
            className="flex-1 px-4 py-2.5 rounded-2xl border border-zinc-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-zinc-400"
          />
          <button
            id="btn-submit-new-student"
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            Přidat
          </button>
        </form>
      </div>

      {/* Roster Card */}
      <div
        id="roster-card"
        className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-zinc-200 space-y-4"
      >
        {/* Header & stats */}
        <div className="flex flex-wrap items-center justify-between gap-2" id="roster-header">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-700" />
            <h2 className="text-base font-bold text-zinc-900" id="roster-title">
              Seznam studentů ({currentClass.name})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              id="roster-stats-pill"
              className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 rounded-full text-zinc-600"
            >
              {activeCount} / {students.length} aktivních
            </span>
          </div>
        </div>

        {/* Toolbar: Search + Bulk Controls */}
        <div className="flex flex-col sm:flex-row gap-2" id="roster-toolbar">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-students"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Vyhledat v seznamu..."
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0" id="roster-bulk-actions">
            <button
              id="btn-bulk-activate-all"
              type="button"
              onClick={onResetAllActive}
              className="px-2.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              title="Zapojit všechny studenty zpět do losování"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vše aktivní</span>
            </button>

            <button
              id="btn-bulk-deactivate-all"
              type="button"
              onClick={() => onToggleAll(0)}
              className="px-2.5 py-2 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              title="Dočasně vyškrtnout všechny studenty"
            >
              <Ban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vyškrtnout vše</span>
            </button>
          </div>
        </div>

        {/* List of students */}
        <div
          id="students-scroll-list"
          className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1"
        >
          {loading ? (
            <div className="py-12 text-center text-zinc-400 text-sm">Načítám studenty...</div>
          ) : students.length === 0 ? (
            <div className="py-10 px-4 text-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 space-y-3" id="empty-roster-state">
              <p className="text-zinc-500 text-sm font-medium">Tato třída zatím nemá žádné studenty.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  id="btn-empty-state-import"
                  type="button"
                  onClick={onOpenImport}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Nahrát ze souboru (CSV / XLSX)
                </button>
              </div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 text-xs">
              Žádný student neodpovídá vyhledávání "{searchQuery}"
            </div>
          ) : (
            <AnimatePresence>
              {filteredStudents.map((student) => {
                const isActive = student.is_active === 1;
                return (
                  <motion.div
                    layout
                    key={student.id}
                    id={`student-row-${student.id}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-white border-zinc-200/90 shadow-2xs'
                        : 'bg-zinc-50/80 border-zinc-100 text-zinc-400'
                    }`}
                  >
                    {/* Toggle button and Name */}
                    <button
                      id={`btn-toggle-student-${student.id}`}
                      type="button"
                      onClick={() => onToggleActive(student.id, student.is_active)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0 group cursor-pointer focus:outline-hidden"
                      title={isActive ? 'Kliknutím vyškrtnout z losování' : 'Kliknutím vrátit do losování'}
                    >
                      <div className="shrink-0">
                        {isActive ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                        ) : (
                          <Circle className="w-5 h-5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium truncate ${
                          !isActive ? 'line-through text-zinc-400' : 'text-zinc-800'
                        }`}
                      >
                        {student.name}
                      </span>
                    </button>

                    {/* Delete button */}
                    <button
                      id={`btn-delete-student-${student.id}`}
                      type="button"
                      onClick={() => setStudentToDelete(student)}
                      className="p-1.5 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer ml-2"
                      title="Smazat studenta ze třídy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Helpful Tip */}
        <div className="pt-2 text-xs text-zinc-400 flex items-center justify-between border-t border-zinc-100">
          <span>Tip: Kliknutím na studenta ho vyškrtnete z losování.</span>
          {students.length > 0 && (
            <button
              id="btn-footer-import-shortcut"
              type="button"
              onClick={onOpenImport}
              className="text-emerald-700 hover:underline font-semibold cursor-pointer"
            >
              + Přidat další ze souboru
            </button>
          )}
        </div>
      </div>

      {/* In-app confirmation modal for deleting a student */}
      {studentToDelete && (
        <div
          id="delete-student-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setStudentToDelete(null)}
        >
          <div
            id="delete-student-modal"
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-zinc-900">
                Smazat studenta?
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Opravdu si přejete smazat studenta <strong>„{studentToDelete.name}“</strong> ze třídy {currentClass.name}?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                id="btn-cancel-delete-student"
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer"
              >
                Zrušit
              </button>
              <button
                id="btn-confirm-delete-student"
                type="button"
                onClick={async () => {
                  const id = studentToDelete.id;
                  setStudentToDelete(null);
                  await onDeleteStudent(id);
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
