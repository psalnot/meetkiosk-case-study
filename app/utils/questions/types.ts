/**
 * Represents a hierarchical question node in the CSRD compliance questionnaire structure.
 * 
 * This interface models questions as a tree structure where each node can be:
 * - A **section header** (content: "") - acts as a titled container with no direct answer
 * - A **table container** (content: "Table") - groups related child questions with dynamic row expansion
 * - A **leaf question** (content: "number"|"enum"|"Text") - represents an actual answerable field
 * 
 * @example Section Header
 * ```ts
 * {
 *   id: "S1-6_13",
 *   labelEn: "Methodologies and context",
 *   content: "",
 *   order: 5,
 *   children: [/* methodology questions *\/]
 * }
 * ```
 * 
 * @example Table Container  
 * ```ts
 * {
 *   id: "S1-6_04", 
 *   labelEn: "Employees by country of significant employment",
 *   content: "Table",
 *   order: 2,
 *   children: [
 *     { id: "S1-6_05", labelEn: "Headcount at period end", content: "number" },
 *     { id: "S1-6_06", labelEn: "Average headcount", content: "number" }
 *   ]
 * }
 * ```
 * 
 * @example Leaf Question
 * ```ts
 * {
 *   id: "S1-6_02",
 *   labelEn: "Number of employees (end of period)", 
 *   content: "number",
 *   unit: "employees",
 *   order: 1,
 *   children: []
 * }
 * ```
 * 
 * **Key Semantic Rules:**
 * - **Empty content ("")**: Section headers that serve as organizational containers. These never have answers but contain child questions.
 * - **"Table" content**: Dynamic table containers that generate multiple answer rows based on data dimensions (country, gender, category, etc.).
 * - **Primitive content ("number"|"enum"|"Text")**: Actual answerable questions that appear in forms and reports.
 * - **Order property**: Determines display sequence within the same parent level (lower numbers appear first).
 * - **Children array**: Always present (empty for leaf nodes), enabling recursive tree traversal and rendering.
 * 
 * **Localization Support:**
 * - `labelEn`/`labelFr`: Primary and secondary language labels
 * - `enumEn`/`enumFr`: Corresponding enumeration values for select-type questions
 * 
 * **Data Integrity Guarantees:**
 * - Every node has a unique `id` following the CSRD question numbering convention (e.g., "S1-6_02")
 * - `order` is always defined and determines sibling ordering
 * - `children` is never null (empty array for leaf nodes)
 * - `parentId` maintains referential integrity in flat representations (when used)
 */


export interface QuestionNode {
  id: string;
  labelEn: string;
  labelFr?: string; // Optional per your requirement
  content: "number" | "Table" | "enum" | "Text" | "";
  parentId?: string; // Clearer than "relatedQuestionId"
  order: number;
  unit?: string;
  enumEn?: string[];
  enumFr?: string[];
  children: QuestionNode[]; // Critical for tree structure
}
