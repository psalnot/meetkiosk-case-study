/**
 * Normalized employee record extracted from DSN.
 * All fields are derived from specific DSN blocks for auditability.
 */
export interface Employee {
  id: string;                     // S21.G00.30.001
  country: string;                // S21.G00.11.015 (Establishment country code ISO code)
  birthCountry: string;           // S21.G00.30.029 
  gender: "M" | "F" | null;       // S21.G00.30.005 ("1" = M, "2" = F)
  contractStart: Date | null;     // S21.G00.40.030 (YYYYMMDD)
  contractEnd: Date | null;       // S21.G00.40.031 (YYYYMMDD)
  pcsEse: string | null;          // S21.G00.40.004 (job classification)
}

/**
 * Structured answer with data lineage.
 */
export interface Answer {
  value: string | number | null;
  source: "computed" | "manual";
  explanation: string; // Human-readable justification for audit
}

// NEW: Enhanced types for change tracking
export interface ComputedAnswer {
  value: number | string | null;
  explanation: string;
  source: "computed";
}

export interface ManualAnswer {
  value: number | string | null;
  explanation: string;
  source: "manual";
  isModified?: false;
}

// Unmodified computed answers
export interface UnmodifiedComputedAnswer {
  value: number | string | null;
  explanation: string;
  source: "computed";
  isModified: false;
  originalValue: number | string | null;
  originalExplanation: string;
}


export interface ModifiedComputedAnswer {
  value: number | string | null;
  explanation: string;
  source: "computed";
  isModified: true;
  originalValue: number | string | null;
  originalExplanation: string;
}

// Union type for all possible answer states

export type TrackedAnswer = 
  | ManualAnswer 
  | UnmodifiedComputedAnswer 
  | ModifiedComputedAnswer;

// Instead of extending, use intersection
export type EditableAnswer = TrackedAnswer & {
  isEditing?: boolean;
  tempValue?: string;
  tempExplanation?: string;
};