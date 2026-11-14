/**
 * Types and helpers for the admin portal's data manager (/admin/data), which shows every table
 * the Django admin has. The backend describes each table (columns, fields, filters), so these
 * pages work for any table without table-specific code.
 */
import {
  Bell, BookmarkSimple, BookOpen, CalendarCheck, Certificate, ChatCircleText, Database, Exam, Eye,
  GraduationCap, LinkSimple, ListBullets, PlayCircle, QrCode, Question, Receipt, SquaresFour, TrendUp, Users,
  type Icon,
} from "@phosphor-icons/react";

export type FieldKind =
  | "text" | "textarea" | "email" | "url" | "integer" | "decimal" | "boolean"
  | "date" | "datetime" | "choice" | "relation" | "json" | "file";

export interface FieldMeta {
  name: string;
  label: string;
  kind: FieldKind;
  editable: boolean;
  required: boolean;
  help: string;
  options?: { value: string | number; label: string }[];
  /** For relations: the table the linked record lives in (if it has one). */
  table?: string | null;
}

export interface TableMeta {
  slug: string;
  label: string;
  singular: string;
  group: string;
  icon: string;
  columns: FieldMeta[];
  fields: FieldMeta[];
  filters: { name: string; label: string; options: { value: string; label: string }[] }[];
  searchable: boolean;
  note: string;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export type RelationValue = { id: number; label: string } | null;
export type CellValue = string | number | boolean | null | RelationValue | unknown[] | Record<string, unknown>;

export interface DataRow {
  id: number;
  label: string;
  values: Record<string, CellValue>;
}

export interface DataPage {
  table: TableMeta;
  count: number;
  page: number;
  pages: number;
  results: DataRow[];
}

export interface DataTables {
  groups: { name: string; tables: { slug: string; label: string; icon: string; count: number }[] }[];
}

const ICONS: Record<string, Icon> = {
  Bell, BookmarkSimple, BookOpen, CalendarCheck, Certificate, ChatCircleText, Exam, Eye, GraduationCap,
  LinkSimple, ListBullets, PlayCircle, QrCode, Question, Receipt, SquaresFour, TrendUp, Users,
};

export const tableIcon = (name: string): Icon => ICONS[name] ?? Database;

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** A value as short readable text for a table cell. */
export function displayValue(field: FieldMeta, value: CellValue): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.kind) {
    case "relation":
      return (value as { label: string }).label;
    case "boolean":
      return value ? "Yes" : "No";
    case "choice":
      return field.options?.find((o) => String(o.value) === String(value))?.label ?? String(value);
    case "datetime":
      return dateTime.format(new Date(value as string));
    case "date":
      return dateOnly.format(new Date(value as string));
    case "json":
      return Array.isArray(value) ? `${value.length} item${value.length === 1 ? "" : "s"}` : JSON.stringify(value);
    default:
      return String(value);
  }
}
