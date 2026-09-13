export interface ClassItem {
  id: number;
  name: string;
  created_at: string;
  total_students: number;
  active_students: number;
}

export interface Student {
  id: number;
  class_id: number;
  name: string;
  is_active: number;
}

export interface ParsedStudent {
  id: string;
  name: string;
}

export interface ClassWithStudents {
  name: string;
  students: string[];
}
