import { Declaration } from "~/utils/dsn-parser/dsn-reader.server";
import { Employee } from "./types.server";


/**
 * Converts raw DSN declaration into normalized Employee records.
 * Handles missing data gracefully and parses DSN-specific formats.
 */
export function normalizeEmployees(declaration: Declaration): Employee[] {
  const employees: Employee[] = [];
  
  // Handle multiple establishments
  const etablissements = declaration.entreprise?.etablissements || [];
  
  for (const etablissement of etablissements) {
    const establishmentCountryCode = etablissement.countryCode || "unknown";
    const individus = etablissement.individus || [];
    
    for (const individu of individus) {
      // Get the latest contract (DSN may contain historical contracts)
      const contract = individu.contrats[individu.contrats.length - 1];
      
      employees.push({
        id: individu.identifiant || "",
        country: establishmentCountryCode, // S21.G00.11.015 (employment country)
        birthCountry: individu.pays || "", // S21.G00.30.029 (birth country)
        gender: parseGender(individu.sexe),
        contractStart: contract?.dateDebut ? parseDsnDate(contract.dateDebut) : null,
        contractEnd: contract?.dateFin ? parseDsnDate(contract.dateFin) : null,
        pcsEse: contract?.pcsEse || null,
      });
    }
  }
  
  return employees;
}

/**
 * Parses DSN gender code:
 * - "1" → "M"
 * - "2" → "F"
 * - anything else → null
 */
/*function parseGender(sexeCode: string | undefined): "M" | "F" | null {
  if (sexeCode === "1") return "M";
  if (sexeCode === "2") return "F";
  return null;
}*/
function parseGender(sexeCode: string | undefined): "M" | "F" | null {
  if (!sexeCode) return null;
  
  // Handle both "1"/"01" and "2"/"02"
  const normalized = sexeCode.padStart(2, '0');
  if (normalized === "01") return "M";
  if (normalized === "02") return "F";
  return null;
}

/**
 * Parses DSN date format (YYYYMMDD) into JavaScript Date.
 * Returns null for invalid dates.
 */
function parseDsnDate(dsnDateStr: string): Date | null {
  // DSN dates are YYYYMMDD (e.g., "20251130")
  if (!/^\d{8}$/.test(dsnDateStr)) return null;
  
  const year = parseInt(dsnDateStr.substring(0, 4), 10);
  const month = parseInt(dsnDateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
  const day = parseInt(dsnDateStr.substring(6, 8), 10);
  // Use this if DSN date format is YYYYMMDD
  //const parsedDay = parseInt(dsnDateStr.substring(6, 8), 10);
  //const day = Number.isNaN(parsedDay) ? 3 : parsedDay;
  
  const date = new Date(year, month, day);
  
  // Validate date (e.g., rejects "20250230")
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  
  return date;
}
