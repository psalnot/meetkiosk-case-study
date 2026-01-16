import { Employee } from "../types.server";

/**
 * Counts employees who left during the reporting period.
 * 
 *  Addresses the following ESG/CSRD question:
 *   - S1-6_11: Number of leavers during period
 * 
 * An employee is considered a "leaver" if:
 * - They have a contract end date
 * - The end date falls within [periodStart, periodEnd] (inclusive)
 * 
 * @param employees - Normalized employee records from DSN
 * @param period - { start: Date, end: Date } of reporting period
 * @returns { value: number, explanation: string }
 */
export function computeLeavers(
  employees: Employee[],
  period: { start: Date; end: Date }
): { value: number; explanation: string } {
  const leavers = employees.filter(emp => {
    if (!emp.contractEnd) return false;
    return emp.contractEnd >= period.start && emp.contractEnd <= period.end;
  });

  const count = leavers.length;
  const start = formatDate(period.start);
  const end = formatDate(period.end);
  
  return {
    value: count,
    explanation: `${count} employee${count !== 1 ? 's' : ''} left between ${start} and ${end}`
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
