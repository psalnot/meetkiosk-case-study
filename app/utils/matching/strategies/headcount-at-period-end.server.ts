import { Employee } from "../types.server";

/**
 * Computes the number of employees with active contracts at a given period end date.
 * 
 * An employee is considered "active" if:
 * - Contract start ≤ periodEndDate
 * - (Contract end is null OR contract end > periodEndDate)
 * 
 *  Addresses the following  questions (Extract from questions.csv):
 *   - S1-6_02: Number of employees (end of period)
 *   - S1-6_05: Number of employees (end of period) [by country]
 *   - K_718:   Number of employees (end of period) [by gender/contract]
 *   - S1-6_09: Number of employees (end of period) [by region]
 *   - S1-6_19: Number of employees (end of period) [by category]
 * 
 * @param employees - Normalized employee records from DSN
 * @param periodEndDate - End date of reporting period (from DSN S20.G00.05.005)
 * @returns { value: number, explanation: string }
 */
export function computeHeadcountAtPeriodEnd(
  employees: Employee[],
  periodEndDate: Date
): { value: number; explanation: string } {
  const activeEmployees = employees.filter(emp => {
    if (!emp.contractStart) return false;
    if (emp.contractStart > periodEndDate) return false;
    if (emp.contractEnd && emp.contractEnd <= periodEndDate) return false;
    return true;
  });

  const count = activeEmployees.length;
  const formattedDate = formatDateForExplanation(periodEndDate);
  
  return {
    value: count,
    explanation: `${count} employee${count !== 1 ? 's' : ''} with active contracts as of ${formattedDate}`
  };
}

function formatDateForExplanation(date: Date): string {
  return date.toISOString().split('T')[0];
}
