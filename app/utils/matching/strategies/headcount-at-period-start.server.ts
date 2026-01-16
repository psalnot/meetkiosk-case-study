import { Employee } from "../types.server";

export function computeHeadcountAtPeriodStart(
  employees: Employee[],
  periodStart: Date
): { value: number; explanation: string } {
  const activeAtStart = employees.filter(emp => 
    emp.contractStart && emp.contractStart <= periodStart &&
    (!emp.contractEnd || emp.contractEnd >= periodStart)
  ).length;
  
  return {
    value: activeAtStart,
    explanation: `${activeAtStart} employees with active contracts as of ${periodStart.toISOString().split('T')[0]}`
  };
}
