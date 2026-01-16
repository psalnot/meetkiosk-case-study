
import { readFileSync } from "fs";
import { resolve } from "path";
import { QuestionNode } from "./types";
import { QUESTIONS_CONFIG } from "config/questions";

/**
 * Parses a single CSV line with semicolon delimiter.
 * Handles empty fields and trailing semicolons.
 */
export function parseCsvLine(line: string): string[] {
  if (!line.trim()) return [];
  return line.split(';').map(field => field.trim());
}

/**
 * Converts parsed CSV values into a key-value row object.
 */
export function createRowObject(headers: string[], values: string[]): Record<string, string> {
  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    row[header] = values[index] ?? "";
  });
  return row;
}

/**
 * Transforms a row object into a QuestionNode with processed fields.
 */
export function createQuestionNode(row: Record<string, string>): QuestionNode {
  // Parse enums (comma-separated as per your CSV format)
  const enumEn = row["enum en"] 
    ? row["enum en"].split(",").map(s => s.trim()).filter(Boolean)
    : undefined;
  const enumFr = row["enum fr"] 
    ? row["enum fr"].split(",").map(s => s.trim()).filter(Boolean)
    : undefined;

  return {
    id: row["ID"],
    labelEn: row["question label en"],
    labelFr: row["question label fr"] || undefined,
    content: row["content"] as any,
    parentId: row["relatedQuestion ID"] || undefined,
    order: parseInt(row["order"], 10) || 0,
    unit: row["unit"] || undefined,
    enumEn,
    enumFr,
    children: [],
  };
}

/**
 * Parses a semicolon-separated CSV file into a tree of QuestionNode objects.
 */
export function loadQuestionsFromCsv(): QuestionNode[] {
  const absolutePath = resolve(process.cwd(), QUESTIONS_CONFIG.csvPath);
  const fileContent = readFileSync(absolutePath, "utf-8");
  
  const REQUIRED_CSV_FIELDS = ["ID", "question label en", "content", "order"];

  const lines = fileContent
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must contain header and at least one data row");
  }

  const headers = parseCsvLine(lines[0]);
  const dataLines = lines.slice(1);

  // Validate required fields
  for (const field of REQUIRED_CSV_FIELDS) {
    if (!headers.includes(field)) {
      throw new Error(`Missing required CSV column: "${field}"`);
    }
  }

  // Step 1: Parse flat questions
  const flatQuestions: QuestionNode[] = dataLines.map((line, rowIndex) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) {
      throw new Error(
        `Row ${rowIndex + 1}: expected ${headers.length} fields, got ${values.length}`
      );
    }
    
    const row = createRowObject(headers, values);
    return createQuestionNode(row);
  });

  // Step 2: Build tree structure
  const questionMap = new Map<string, QuestionNode>();
  const roots: QuestionNode[] = [];

  // First pass: index all nodes
  for (const q of flatQuestions) {
    questionMap.set(q.id, q);
  }

  // Second pass: build hierarchy
  for (const q of flatQuestions) {
    if (q.parentId && questionMap.has(q.parentId)) {
      questionMap.get(q.parentId)!.children.push(q);
    } else {
      roots.push(q);
    }
  }

  // Sort children by order
  function sortChildren(node: QuestionNode) {
    node.children.sort((a, b) => a.order - b.order);
    node.children.forEach(sortChildren);
  }
  roots.forEach(sortChildren);

  return roots;
}