import { Employee } from "../types.server";

/**
 * Groups employees by a specified attribute to enable segmented ESG reporting.
 * 
 * This strategy supports CSRD's requirement for disaggregated workforce data
 * (e.g., by geography, gender, or job category) and powers all "table" questions
 * in the Kiosk questionnaire.
 * 
 *  Addresses the following ESG/CSRD table questions:
 *   - S1-6_04: Employees by country (uses attribute = "country")
 *   - S1-6_07: Employees by gender and contract type (uses attribute = "gender")
 *   - S1-6_08: Employees by region (uses attribute = "country" + mapping to regions)
 *   - S1-6_18: Employees by professional category (uses attribute = "pcsEse")
 * 
 *  How it works:
 *   1. Takes normalized Employee[] records from DSN
 *   2. Groups them by the specified attribute (country, gender, pcsEse)
 *   3. Returns a map of { [attributeValue]: Employee[] }
 *   4. Downstream strategies (headcount, average) then compute metrics per group
 * 
 *  Example output for S1-6_04 (by country):
 *   {
 *     "FR": [emp1, emp2, ...],  // French employees
 *     "DE": [emp3, emp4, ...],  // German employees  
 *     "ES": [emp5, ...]         // Spanish employees
 *   }
 * 
 *  Important notes:
 *   - Missing/empty attribute values are grouped under "unknown"
 *   - Country codes follow ISO 3166-1 alpha-2 (from DSN S21.G00.30.029)
 *   - Gender uses DSN codes: "1"=M, "2"=F (normalized in Employee type)
 *   - PCS-ESE codes come from DSN S21.G00.40.004 (job classification)
 * 
 * @param employees - Normalized employee records from DSN
 * @param attribute - The Employee field to group by ("country" | "gender" | "pcsEse")
 * @returns Record<string, Employee[]> where keys are attribute values
 */

export function groupByAttribute(
  employees: Employee[],
  attribute: "country" | "gender" | "pcsEse"
): Record<string, Employee[]> {
  const groups: Record<string, Employee[]> = {};

  for (const emp of employees) {
    // Handle missing/empty values
    let key = emp[attribute] as string;
    if (!key || key.trim() === "") {
      key = "unknown";
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(emp);
  }

  return groups;
}
