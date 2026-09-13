import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "students.db");
const db = new Database(dbPath);

// Initialize database schemas
db.exec(`
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    class_id INTEGER
  );
`);

// Migration: ensure class_id exists in students table
const studentCols = db.prepare("PRAGMA table_info(students)").all() as Array<{ name: string }>;
if (!studentCols.some((col) => col.name === "class_id")) {
  db.exec("ALTER TABLE students ADD COLUMN class_id INTEGER;");
}

// Migration: ensure at least one default class exists if none
const classCountResult = db.prepare("SELECT COUNT(*) as count FROM classes").get() as { count: number };
if (classCountResult.count === 0) {
  const info = db.prepare("INSERT INTO classes (name) VALUES (?)").run("1.A");
  const defaultClassId = info.lastInsertRowid;
  db.prepare("UPDATE students SET class_id = ? WHERE class_id IS NULL OR class_id = 0").run(defaultClassId);
} else {
  const firstClass = db.prepare("SELECT id FROM classes ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
  if (firstClass) {
    db.prepare("UPDATE students SET class_id = ? WHERE class_id IS NULL OR class_id = 0").run(firstClass.id);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Classes endpoints
  app.get("/api/classes", (req, res) => {
    const classes = db.prepare(`
      SELECT 
        c.id, 
        c.name, 
        c.created_at,
        COUNT(s.id) as total_students,
        COALESCE(SUM(CASE WHEN s.is_active = 1 THEN 1 ELSE 0 END), 0) as active_students
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE ASC
    `).all();
    res.json(classes);
  });

  app.post("/api/classes", (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Název třídy je povinný" });
    const info = db.prepare("INSERT INTO classes (name) VALUES (?)").run(name.trim());
    res.json({ id: info.lastInsertRowid, name: name.trim(), total_students: 0, active_students: 0 });
  });

  app.patch("/api/classes/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Název třídy je povinný" });
    db.prepare("UPDATE classes SET name = ? WHERE id = ?").run(name.trim(), id);
    res.json({ success: true, name: name.trim() });
  });

  app.delete("/api/classes/:id", (req, res) => {
    const { id } = req.params;
    const numId = Number(id);
    const deleteTx = db.transaction(() => {
      db.prepare("DELETE FROM students WHERE class_id = ?").run(numId);
      db.prepare("DELETE FROM classes WHERE id = ?").run(numId);
    });
    deleteTx();
    res.json({ success: true });
  });

  // Students in class endpoints
  app.get("/api/classes/:id/students", (req, res) => {
    const { id } = req.params;
    const students = db.prepare(
      "SELECT id, class_id, name, is_active FROM students WHERE class_id = ? ORDER BY name COLLATE NOCASE ASC"
    ).all(id);
    res.json(students);
  });

  app.post("/api/classes/:id/students", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Jméno studenta je povinné" });
    const info = db.prepare("INSERT INTO students (name, class_id, is_active) VALUES (?, ?, 1)").run(name.trim(), id);
    res.json({ id: info.lastInsertRowid, name: name.trim(), class_id: Number(id), is_active: 1 });
  });

  // Bulk import into new class
  app.post("/api/classes/import", (req, res) => {
    const { className, students } = req.body as { className: string; students: string[] };
    if (!className || !className.trim()) {
      return res.status(400).json({ error: "Název třídy je povinný" });
    }
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: "Seznam studentů nesmí být prázdný" });
    }

    const trimmedClassName = className.trim();
    const cleanNames = students.map((s) => String(s).trim()).filter((s) => s.length > 0);

    if (cleanNames.length === 0) {
      return res.status(400).json({ error: "Nebylo nalezeno žádné platné jméno" });
    }

    const importTx = db.transaction(() => {
      const classInfo = db.prepare("INSERT INTO classes (name) VALUES (?)").run(trimmedClassName);
      const classId = classInfo.lastInsertRowid;
      const insertStudent = db.prepare("INSERT INTO students (name, class_id, is_active) VALUES (?, ?, 1)");
      for (const name of cleanNames) {
        insertStudent.run(name, classId);
      }
      return classId;
    });

    const newClassId = importTx();
    res.json({
      success: true,
      classId: newClassId,
      className: trimmedClassName,
      importedCount: cleanNames.length,
    });
  });

  // Bulk import students into an existing class
  app.post("/api/classes/:id/import-students", (req, res) => {
    const { id } = req.params;
    const { students } = req.body as { students: string[] };
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: "Seznam studentů nesmí být prázdný" });
    }
    const cleanNames = students.map((s) => String(s).trim()).filter((s) => s.length > 0);
    const insertTx = db.transaction(() => {
      const insertStudent = db.prepare("INSERT INTO students (name, class_id, is_active) VALUES (?, ?, 1)");
      for (const name of cleanNames) {
        insertStudent.run(name, id);
      }
    });
    insertTx();
    res.json({ success: true, importedCount: cleanNames.length });
  });

  // Reset all students in class to active
  app.patch("/api/classes/:id/reset-active", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE students SET is_active = 1 WHERE class_id = ?").run(id);
    res.json({ success: true });
  });

  // Toggle all students active/inactive
  app.patch("/api/classes/:id/toggle-all", (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    db.prepare("UPDATE students SET is_active = ? WHERE class_id = ?").run(is_active ? 1 : 0, id);
    res.json({ success: true });
  });

  // Individual student operations
  app.patch("/api/students/:id", (req, res) => {
    const { id } = req.params;
    const { is_active, name } = req.body;
    if (typeof is_active !== "undefined") {
      db.prepare("UPDATE students SET is_active = ? WHERE id = ?").run(is_active ? 1 : 0, id);
    }
    if (typeof name !== "undefined" && name.trim()) {
      db.prepare("UPDATE students SET name = ? WHERE id = ?").run(name.trim(), id);
    }
    res.json({ success: true });
  });

  app.delete("/api/students/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM students WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Legacy fallback
  app.get("/api/students", (req, res) => {
    const students = db.prepare("SELECT * FROM students").all();
    res.json(students);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

