// app/utils/matching/extract-period.server.ts
import { Declaration } from "~/utils/dsn-parser/dsn-reader.server";

/**
 * Extracts the reporting period from a DSN (Déclaration Sociale Nominative) declaration.
 * 
 * **DSN Period Format Specification**
 * The French DSN standard uses field S20.G00.05.005 ("Mois") to indicate the reporting period.
 * This field can contain either:
 *   - 6-digit format: YYYYMM (e.g., "202511" = November 2025)
 *   - 8-digit format: YYYYMMDD (e.g., "20251130" = November 30, 2025)
 * 
 * In practice, both formats represent the **same reporting month**. The day component
 * in the 8-digit format is typically the last day of the month but is irrelevant for
 * period calculations.
 * 
 *  **Implementation Strategy**
 * - Accepts both 6-digit and 8-digit formats for maximum compatibility
 * - Truncates 8-digit values to first 6 characters (YYYYMM)
 * - Validates year/month ranges to prevent invalid dates
 * - Returns the full calendar month as a date range [start, end]
 * 
 *  **Example Conversions**
 *   "202511"     → Nov 1, 2025 to Nov 30, 2025
 *   "20251130"   → Nov 1, 2025 to Nov 30, 2025  
 *   "20240229"   → Feb 1, 2024 to Feb 29, 2024 (leap year handled automatically)
 * 
 * **Error Handling**
 * Throws descriptive errors for:
 *   - Missing S20.G00.05.005 field (mois = undefined)
 *   - Invalid formats (non-numeric, wrong length)
 *   - Out-of-range years/months
 * 
 * @param declaration - Parsed DSN declaration object from dsn-reader
 * @returns { start: Date, end: Date } representing the full reporting month
 * @throws Error with context-specific message if period extraction fails
 */
export function extractReportingPeriod(declaration: Declaration): { start: Date; end: Date } {
  const moisStr = declaration.mois;
  

  // First check if mois exists at all
  if (moisStr === undefined || moisStr === null) {
    throw new Error(
      `Missing reporting period in DSN (S20.G00.05.005). Field not found in parsed declaration.`
    );
  }

  // Then validate format
  if (typeof moisStr !== 'string' || !/^\d{6,8}$/.test(moisStr)) {
    throw new Error(
      `Invalid reporting period format in DSN (S20.G00.05.005). ` +
      `Expected 6-digit (YYYYMM) or 8-digit (YYYYMMDD) format. Got: "${moisStr}"`
    );
  }
  

  // Normalize to 6-digit YYYYMM format
  const yyyymm = moisStr.length === 8 ? moisStr.substring(0, 6) : moisStr;

  // Parse year and month
  const year = parseInt(yyyymm.substring(0, 4), 10);
  const month = parseInt(yyyymm.substring(4, 6), 10) - 1; // JavaScript months are 0-indexed

  // Validate year/month ranges
  if (year < 1900 || year > 2100 || month < 0 || month > 11) {
    throw new Error(`Invalid period values in DSN: "${moisStr}" (year: ${year}, month: ${month + 1})`);
  }

  // Construct date range for the full month
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // Last day of the month (automatically handles leap years)

  return { start, end };
}