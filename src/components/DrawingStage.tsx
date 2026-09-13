import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shuffle,
  Trophy,
  UserX,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  User,
  Users,
} from 'lucide-react';
import { Student } from '../types';

interface DrawingStageProps {
  classNameTitle: string;
  students: Student[];
  onToggleActive: (id: number, currentStatus: number) => Promise<void>;
  onResetAllActive: () => Promise<void>;
}

type DrawMode = 'single' | 'pair';

export default function DrawingStage({
  classNameTitle,
  students,
  onToggleActive,
  onResetAllActive,
}: DrawingStageProps) {
  const [drawMode, setDrawMode] = useState<DrawMode>('single');
  const [drawnStudents, setDrawnStudents] = useState<Student[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const activeStudents = students.filter((s) => s.is_active === 1);
  const inactiveStudentsCount = students.length - activeStudents.length;

  const minRequiredStudents = drawMode === 'pair' ? 2 : 1;
  const canDraw = activeStudents.length >= minRequiredStudents;

  // Simple Web Audio API sound for ticking and celebration
  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch {
      // AudioContext may be restricted before user gesture
    }
  };

  const playFanfareSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.1);
        osc.stop(audioCtx.currentTime + idx * 0.1 + 0.35);
      });
    } catch {
      // AudioContext catch
    }
  };

  // Helper to get 1 or 2 unique random students
  const getRandomSelection = (): Student[] => {
    if (activeStudents.length === 0) return [];
    if (drawMode === 'single') {
      const randomIdx = Math.floor(Math.random() * activeStudents.length);
      return [activeStudents[randomIdx]];
    } else {
      // Pair mode: pick 2 distinct students
      const idx1 = Math.floor(Math.random() * activeStudents.length);
      let idx2 = Math.floor(Math.random() * (activeStudents.length - 1));
      if (idx2 >= idx1) idx2++;
      return [activeStudents[idx1], activeStudents[idx2]];
    }
  };

  const drawStudents = () => {
    if (!canDraw) return;

    setIsDrawing(true);
    setDrawnStudents([]);

    let counter = 0;
    const maxSteps = 24;
    let currentSpeed = 50;

    const runStep = () => {
      counter++;
      const currentCandidates = getRandomSelection();
      setDrawnStudents(currentCandidates);
      playTickSound();

      if (counter < maxSteps) {
        if (counter > 15) {
          currentSpeed += 25;
        }
        setTimeout(runStep, currentSpeed);
      } else {
        const finalWinners = getRandomSelection();
        setDrawnStudents(finalWinners);
        setIsDrawing(false);
        playFanfareSound();
      }
    };

    runStep();
  };

  const handleExcludeStudent = async (studentId: number) => {
    await onToggleActive(studentId, 1);
    setDrawnStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const handleExcludeAllDrawn = async () => {
    for (const student of drawnStudents) {
      await onToggleActive(student.id, 1);
    }
    setDrawnStudents([]);
  };

  const switchMode = (mode: DrawMode) => {
    if (isDrawing) return;
    setDrawMode(mode);
    setDrawnStudents([]);
  };

  return (
    <div
      id="drawing-stage-card"
      className="bg-zinc-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col items-center justify-between min-h-[420px] shadow-xl relative overflow-hidden border border-zinc-800"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-500 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-teal-500 rounded-full blur-3xl" />
      </div>

      {/* Top row: class badge, mode selector, sound toggle */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 z-10" id="drawing-header-bar">
        <div className="flex items-center gap-2">
          <span
            id="drawing-active-class-pill"
            className="px-3 py-1 bg-zinc-800/90 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {classNameTitle}
          </span>
          <span
            id="drawing-active-count-label"
            className="text-xs text-zinc-400 font-medium"
          >
            {activeStudents.length} k losování
          </span>
        </div>

        {/* Mode Selector & Sound */}
        <div className="flex items-center gap-2" id="drawing-top-controls">
          {/* Mode segmented control */}
          <div
            id="draw-mode-segmented-toggle"
            className="bg-zinc-800/90 p-1 rounded-xl border border-zinc-700/60 flex items-center gap-1 text-xs font-semibold"
          >
            <button
              id="btn-mode-single"
              type="button"
              onClick={() => switchMode('single')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                drawMode === 'single'
                  ? 'bg-emerald-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Vylosovat jednoho studenta"
            >
              <User className="w-3.5 h-3.5" />
              <span>Jednotlivec</span>
            </button>
            <button
              id="btn-mode-pair"
              type="button"
              onClick={() => switchMode('pair')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                drawMode === 'pair'
                  ? 'bg-emerald-500 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Vylosovat dvojici studentů pro práci ve dvojicích či dialog"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Dvojice</span>
            </button>
          </div>

          <button
            id="btn-toggle-sound"
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
            title={soundEnabled ? 'Vypnout zvuk' : 'Zapnout zvuk'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Middle Stage: Display Winner(s) or Shuffling State */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-6 z-10 min-h-[190px]">
        <AnimatePresence mode="wait">
          {/* Winner(s) revealed */}
          {drawnStudents.length > 0 && !isDrawing ? (
            <motion.div
              key="winners-display"
              id="winners-display-container"
              initial={{ scale: 0.75, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 24 }}
              className="text-center w-full px-2"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/30 mb-2 shadow-lg shadow-amber-400/10">
                <Trophy className="w-7 h-7 animate-bounce" />
              </div>

              <div
                id="winner-label"
                className="text-xs tracking-widest text-emerald-400 font-bold uppercase mb-2"
              >
                {drawMode === 'pair' ? 'Vylosovaná dvojice' : 'Vylosovaný student'}
              </div>

              {/* Single Mode Result */}
              {drawMode === 'single' && drawnStudents[0] && (
                <div className="space-y-3">
                  <h2
                    id="winner-student-name"
                    className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-sm break-words py-1"
                  >
                    {drawnStudents[0].name}
                  </h2>
                  <div className="flex justify-center">
                    <button
                      id="btn-exclude-winner"
                      type="button"
                      onClick={() => handleExcludeStudent(drawnStudents[0].id)}
                      className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Vyškrtne tohoto studenta z dalších losování"
                    >
                      <UserX className="w-3.5 h-3.5 text-amber-400" />
                      Vyškrtnout z dalšího losování
                    </button>
                  </div>
                </div>
              )}

              {/* Pair Mode Result */}
              {drawMode === 'pair' && drawnStudents.length >= 2 && (
                <div className="space-y-4" id="pair-result-container">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 max-w-xl mx-auto">
                    {/* First student card */}
                    <div
                      id="pair-card-student-0"
                      className="flex-1 w-full bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-4 flex flex-col items-center justify-between shadow-md"
                    >
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        1. Student
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-white text-center break-words">
                        {drawnStudents[0].name}
                      </span>
                      <button
                        id="btn-exclude-pair-student-0"
                        type="button"
                        onClick={() => handleExcludeStudent(drawnStudents[0].id)}
                        className="mt-3 text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Vyškrtnout pouze tohoto studenta"
                      >
                        <UserX className="w-3 h-3" />
                        Vyškrtnout
                      </button>
                    </div>

                    {/* Pair link badge */}
                    <div
                      id="pair-connection-badge"
                      className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-sm shrink-0 shadow-xs"
                    >
                      &
                    </div>

                    {/* Second student card */}
                    <div
                      id="pair-card-student-1"
                      className="flex-1 w-full bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-4 flex flex-col items-center justify-between shadow-md"
                    >
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        2. Student
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-white text-center break-words">
                        {drawnStudents[1].name}
                      </span>
                      <button
                        id="btn-exclude-pair-student-1"
                        type="button"
                        onClick={() => handleExcludeStudent(drawnStudents[1].id)}
                        className="mt-3 text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Vyškrtnout pouze tohoto studenta"
                      >
                        <UserX className="w-3 h-3" />
                        Vyškrtnout
                      </button>
                    </div>
                  </div>

                  {/* Bulk action for the pair: exclude both */}
                  <div className="flex justify-center pt-1">
                    <button
                      id="btn-exclude-both-pair"
                      type="button"
                      onClick={handleExcludeAllDrawn}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      title="Vyškrtne oba vylosované studenty z dalších losování"
                    >
                      <UserX className="w-3.5 h-3.5 text-amber-400" />
                      Vyškrtnout oba z dalšího losování
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : isDrawing ? (
            /* Shuffling Animation State */
            <motion.div
              key="shuffling-display"
              id="shuffling-display-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center w-full px-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
                <Shuffle className="w-7 h-7 animate-spin" />
              </div>
              <div className="text-xs text-zinc-400 tracking-wider uppercase font-semibold mb-1">
                {drawMode === 'pair' ? 'Míchám dvojici...' : 'Míchám seznam...'}
              </div>

              {drawMode === 'single' ? (
                <div
                  id="shuffling-current-name"
                  className="text-2xl sm:text-3xl md:text-4xl font-bold text-emerald-300 truncate"
                >
                  {drawnStudents[0] ? drawnStudents[0].name : '...'}
                </div>
              ) : (
                <div
                  id="shuffling-pair-names"
                  className="text-xl sm:text-2xl md:text-3xl font-bold text-emerald-300 flex items-center justify-center gap-2 truncate"
                >
                  <span>{drawnStudents[0] ? drawnStudents[0].name : '...'}</span>
                  <span className="text-emerald-500 font-normal">&</span>
                  <span>{drawnStudents[1] ? drawnStudents[1].name : '...'}</span>
                </div>
              )}
            </motion.div>
          ) : !canDraw ? (
            /* Not enough students state */
            <motion.div
              key="not-enough-stage"
              id="empty-stage-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center max-w-sm px-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-3">
                <UserX className="w-6 h-6" />
              </div>
              <p className="text-zinc-200 font-semibold mb-1">
                {activeStudents.length === 0
                  ? 'Všichni studenti jsou vyškrtnuti'
                  : 'Nedostatek studentů pro dvojici'}
              </p>
              <p className="text-xs text-zinc-400 mb-4">
                {activeStudents.length === 0
                  ? 'V této třídě již nezbývá žádný aktivní student k vylosování.'
                  : `Pro losování dvojice je potřeba alespoň 2 aktivní studenty (aktuálně je k dispozici pouze ${activeStudents.length}).`}
              </p>
              <button
                id="btn-stage-reset-all"
                type="button"
                onClick={onResetAllActive}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 mx-auto transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Obnovit všechny studenty
              </button>
            </motion.div>
          ) : (
            /* Ready stage */
            <motion.div
              key="ready-stage"
              id="ready-stage-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center px-4"
            >
              <div className="w-16 h-16 rounded-3xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                {drawMode === 'pair' ? (
                  <Users className="w-8 h-8 text-emerald-400" />
                ) : (
                  <Shuffle className="w-8 h-8 text-emerald-400" />
                )}
              </div>
              <p className="text-zinc-200 font-semibold text-lg">
                {drawMode === 'pair' ? 'Připraveno k losování dvojice' : 'Připraveno k losování'}
              </p>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                {drawMode === 'pair'
                  ? `Vylosuje náhodnou dvojici z ${activeStudents.length} aktivních studentů třídy ${classNameTitle}.`
                  : `K dispozici je ${activeStudents.length} studentů ze třídy ${classNameTitle}.`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div
        className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800/80 z-10"
        id="drawing-controls-bar"
      >
        <div className="text-xs text-zinc-400 text-center sm:text-left">
          {inactiveStudentsCount > 0 ? (
            <span>
              {inactiveStudentsCount} student{inactiveStudentsCount === 1 ? '' : 'ů'} vyškrtnuto
            </span>
          ) : (
            <span>Všichni studenti zapojeni</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {inactiveStudentsCount > 0 && (
            <button
              id="btn-quick-reset-all"
              type="button"
              onClick={onResetAllActive}
              className="px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              title="Aktivovat všechny vyškrtnuté studenty"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Zapojit všechny</span>
            </button>
          )}

          <button
            id="btn-draw-student"
            type="button"
            onClick={drawStudents}
            disabled={isDrawing || !canDraw}
            className={`px-6 py-3 rounded-2xl font-bold text-base transition-all transform active:scale-95 cursor-pointer shadow-lg flex items-center gap-2 ${
              isDrawing || !canDraw
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none'
                : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20'
            }`}
          >
            <Shuffle className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
            <span>
              {isDrawing
                ? drawMode === 'pair'
                  ? 'Losuji dvojici...'
                  : 'Losuji...'
                : drawnStudents.length > 0
                ? drawMode === 'pair'
                  ? 'Vylosovat další dvojici'
                  : 'Vylosovat dalšího'
                : drawMode === 'pair'
                ? 'Vylosovat dvojici'
                : 'Vylosovat studenta'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
