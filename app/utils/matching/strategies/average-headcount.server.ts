import { Employee } from "../types.server";


/**
 * Computes the average headcount using the standard CSRD methodology:
 * (Number of employees at start of period + Number of employees at end of period) / 2
 * 
* 
 *  **Employee Eligibility Criteria**
 * An employee is counted as "active" on a given date if:
 * - They have a valid contract start date
 * - Their contract started on or before the reference date
 * - Their contract has not ended before the reference date 
 *   (null/undefined contractEnd = still active)
 * 
 *  **Calculation Logic**
 * 1. Count employees active on period.start (first day of reporting period)
 * 2. Count employees active on period.end (last day of reporting period)  
 * 3. Return (startCount + endCount) / 2 rounded to 1 decimal place
 * 
 *  **Usage Context**
 * This function is designed to work with filtered employee subsets:
 * - Global: all employees in the declaration
 * - Country: employees grouped by establishment country (S1-6_04 table)
 * - Gender: employees grouped by gender code (S1-6_07 table)
 * - Category: employees grouped by PCS-ESE professional category (S1-6_18 table)
 * 
 *  **Assumptions**
 * - Reporting periods are typically single months (e.g., "202511" = November 2025)
 * - Contract dates are properly normalized to Date objects
 * - Employees without contractStart are excluded from calculations
 * 
 * @param employees - Normalized employee records with contract dates
 * @param period - Reporting period with start/end Date boundaries
 * @returns Average headcount value and explanatory message
 */
export function computeAverageHeadcount(
  employees: Employee[],
  period: { start: Date; end: Date }
): { value: number; explanation: string } {
  
  // Count employees active at period start
  const startCount = employees.filter(emp => 
    emp.contractStart && emp.contractStart <= period.start &&
    (!emp.contractEnd || emp.contractEnd >= period.start)
  ).length;
  
  // Count employees active at period end
  const endCount = employees.filter(emp => 
    emp.contractStart && emp.contractStart <= period.end &&
    (!emp.contractEnd || emp.contractEnd >= period.end)
  ).length;
  
  // Simple average: (start + end) / 2
  const average = (startCount + endCount) / 2;
  
  return {
    value: parseFloat(average.toFixed(1)), // Keep 1 decimal place
    explanation: `Average employees: (${startCount} + ${endCount}) / 2 = ${average}`
  };
}


function getMonthsInPeriod(start: Date, end: Date): { year: number; month: number }[] {
  const months = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endTruncated = new Date(end.getFullYear(), end.getMonth(), 1);
  
  while (current <= endTruncated) {
    months.push({ year: current.getFullYear(), month: current.getMonth() });
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

function formatPeriodLabel(period: { start: Date; end: Date }): string {
  const start = period.start;
  const end = period.end;
  
  // Single month
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
  }
  
  // Multi-month
  return `${start.toLocaleString('en-US', { month: 'short', year: 'numeric' })} - ${end.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
}