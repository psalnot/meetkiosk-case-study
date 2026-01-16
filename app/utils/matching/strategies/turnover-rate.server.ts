import { Employee } from "../types.server";
import { computeLeavers } from "./leavers.server";
//import { computeAverageHeadcount } from "./average-headcount.server";
import { computeHeadcountAtPeriodStart } from "./headcount-at-period-start.server";

/**
 * Computes annualized turnover rate as a percentage.
 * 
 * Addresses the following ESG/CSRD question:
 *   - S1-6_12: Turnover rate (%)
 * 
 * Formula: (Number of leavers / Average headcount) * 100
 * 
 * @param employees - Normalized employee records from DSN
 * @param period - { start: Date, end: Date } of reporting period
 * @returns { value: number, explanation: string }
 */
export function computeTurnoverRate(
  employees: Employee[],
  period: { start: Date; end: Date }
): { value: number; explanation: string } {
  const leavers = computeLeavers(employees, period);
  //const avgHeadcount = computeAverageHeadcount(employees, period);
  const startHeadcount = computeHeadcountAtPeriodStart(employees, period.start);
  
  /// Avoid division by zero
  if (startHeadcount.value === 0) {
      return {
        value: 0,
        explanation: "Turnover rate: 0% (no starting headcount)"
      };
  }

  //const rate = Math.round((leavers.value / avgHeadcount.value) * 100);
  const rate = Math.round((leavers.value / startHeadcount.value) * 100);

  return {
    value: rate,
    explanation: `Turnover rate: ${rate}% (${leavers.value} leavers / ${startHeadcount.value} average employees)`
  };
}
