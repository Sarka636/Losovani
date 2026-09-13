import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  FileSpreadsheet,
  Download,
  Github,
  CheckCircle2,
  RefreshCw,
  FolderGit2,
  ArrowRight,
} from 'lucide-react';
import { ClassItem } from '../types';

interface ExportGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassItem[];
  onDownloadAgain: () => Promise<void>;
  onReloadFromGitHub: () => Promise<void>;
  isReloading: boolean;
}

export default function ExportGitHubModal({
  isOpen,
  onClose,
  classes,
  onDownloadAgain,
  onReloadFromGitHub,
  isReloading,
}: ExportGitHubModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
        <motion.div
          id="export-github-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        <motion.div
          id="export-github-modal-card"
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-zinc-200 z-10"
        >
          {/* Close button */}
          <button
            id="btn-close-export-modal"
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900" id="export-modal-title">
                Export tříd pro GitHub (.xlsx)
              </h2>
              <p className="text-xs text-zinc-500">
                Všechny třídy v jednom souboru na samostatných listech
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-zinc-600">
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-950 block text-xs sm:text-sm">
                  Soubor <code className="bg-white/80 px-1.5 py-0.5 rounded text-emerald-800 font-mono">tridy.xlsx</code> byl stažen
                </span>
                <span className="text-xs text-emerald-800 mt-0.5 block">
                  Obsahuje {classes.length} {classes.length === 1 ? 'třídu' : 'třídy'}:{' '}
                  <strong className="font-semibold">{classes.map((c) => c.name).join(', ')}</strong>. Každá třída je na své vlastní záložce (listu).
                </span>
              </div>
            </div>

            {/* Step by step guide */}
            <div className="space-y-3 pt-1">
              <div className="p-3 bg-emerald-50/90 rounded-xl border border-emerald-200/80 text-emerald-950 text-xs space-y-1.5">
                <span className="font-bold flex items-center gap-1.5 text-emerald-950">
                  <Github className="w-4 h-4 text-emerald-700" />
                  Nastavení GitHub Pages (Deploy from a branch &rarr; /docs)
                </span>
                <p className="leading-relaxed text-zinc-700">
                  Ve svém GitHub repozitáři přejděte do <strong>Settings ⚙️ &rarr; Pages</strong>. V sekci <strong>Build and deployment</strong>:
                </p>
                <div className="space-y-1 pl-2 font-mono text-[11px] text-zinc-800">
                  <div>1. <strong>Source:</strong> Deploy from a branch</div>
                  <div>2. <strong>Branch:</strong> <span className="bg-white px-1.5 py-0.5 rounded border border-zinc-200">main</span> (nebo master) a složka <span className="bg-white px-1.5 py-0.5 rounded border border-zinc-200 font-bold text-emerald-700">/docs</span></div>
                  <div>3. Klikněte na <strong>Save</strong></div>
                </div>
                <p className="text-[11px] text-emerald-800 leading-normal pt-0.5">
                  Složka <code className="bg-white/80 px-1 py-0.2 rounded font-mono font-bold">/docs</code> je v projektu zkompilována a připravena včetně všech souborů, takže aplikace naběhne bez prázdné stránky.
                </p>
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 pt-1">
                Jak aktualizovat třídy v repozitáři:
              </h3>
              <ol className="text-xs space-y-2 text-zinc-600 list-decimal list-inside pl-1 leading-relaxed">
                <li>
                  Ve svém repozitáři na GitHubu otevřete složku <code className="bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded font-mono">public/</code> (nebo přímo <code className="bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded font-mono">docs/</code>).
                </li>
                <li>
                  Klikněte na <strong>Add file &rarr; Upload files</strong> a nahrajte stažený soubor <code className="bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded font-mono">tridy.xlsx</code>.
                </li>
                <li>
                  Potvrďte tlačítkem <strong>Commit changes</strong>.
                </li>
              </ol>
              <p className="text-[11px] text-zinc-500 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                Při otevření aplikace na GitHub Pages si aplikace soubor <code className="font-mono">tridy.xlsx</code> automaticky načte.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-wrap gap-2 border-t border-zinc-100 justify-between items-center">
              <button
                id="btn-sync-reload-github"
                type="button"
                onClick={onReloadFromGitHub}
                disabled={isReloading}
                className="px-3 py-2 text-xs font-semibold text-zinc-700 hover:text-emerald-700 hover:bg-zinc-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Znovu stáhne tridy.xlsx ze serveru/GitHubu"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
                <span>{isReloading ? 'Načítám...' : 'Znovu načíst z tridy.xlsx'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  id="btn-download-again"
                  type="button"
                  onClick={onDownloadAgain}
                  className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Stáhnout znovu</span>
                </button>
                <button
                  id="btn-close-export-done"
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  Rozumím
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
