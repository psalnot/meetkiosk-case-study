import { QuestionNode } from "~/utils/questions/types";
import { Declaration } from "~/utils/dsn-parser/dsn-reader.server";
import { Answer } from "./types.server";
import { normalizeEmployees, NormalizedEmployee } from "./normalize.server";
import { extractReportingPeriod } from "./extract-period.server";

// Import all strategies
import { computeHeadcountAtPeriodEnd } from "./strategies/headcount-at-period-end.server";
import { computeAverageHeadcount } from "./strategies/average-headcount.server";
import { computeLeavers } from "./strategies/leavers.server";
import { computeTurnoverRate } from "./strategies/turnover-rate.server";
import { groupByAttribute } from "./strategies/group-by-attribute.server";

/**
 * Orchestrates automated answer computation for Kiosk's ESG questionnaire.
 * 
 *  **Architecture *
 * This implementation support hierarchical question structures:
 * - Processes questions as a tree (not flat list)
 * - Handles table containers with dynamic row expansion
 * - Provides context-aware computation for disaggregated metrics
 * 
 * **Regional Data Handling (ESRS Compliance)**
 * Per ESRS S1-6-3 guidance: "If regional breakdown is not feasible, disclose by country."
 * Since DSN only provides country-level data (S21.G00.30.029), we treat each country as a region
 * for question S1-6_08 ("Employees by region").
 * 
 * **Grouping Strategy Matrix**
 * | Table Question | Grouping Attribute | Source DSN Field | Output Pattern |
 * |----------------|-------------------|------------------|----------------|
 * | S1-6_04 (country) | country | S21.G00.30.029 | S1-6_05_{COUNTRY_CODE} |
 * | S1-6_07 (gender) | gender | S21.G00.30.005 | K_718_{GENDER_CODE} |
 * | S1-6_08 (region) | country* | S21.G00.30.029 | S1-6_09_{COUNTRY_CODE} |
 * | S1-6_18 (category) | pcsEse | S21.G00.40.004 | S1-6_19_{PCS_ESE_CODE} |
 * 
 * * Region = Country (ESRS fallback implementation)
 * 
 * **Strategy Reuse Principle**
 * Existing strategies are reused with filtered employee subsets:
 * - computeHeadcountAtPeriodEnd() → called with country-specific employees
 * - computeAverageHeadcount() → applied to gender-filtered employee subsets to provide disaggregated metrics per the 'Employees by gender' table requirements
 * 
 * @param declaration - Parsed DSN declaration
 * @param questionTree - Hierarchical question structure from questions.csv
 * @returns Record<answerId, Answer> with dynamic keys for table rows
 */

export function computeAnswers(
  declaration: Declaration,
  questionTree: QuestionNode[]
): Record<string, Answer> {
  const period = extractReportingPeriod(declaration);
  const employees = normalizeEmployees(declaration);
  const answers: Record<string, Answer> = {};

  // Process the entire question tree recursively
  processQuestionNodes(declaration, period, employees, questionTree, answers);
  
  return answers;
}

/**
 * Recursively processes question nodes and computes answers.
 * Maintains context about parent tables for proper scoping.
 */
function processQuestionNodes(
  declaration: Declaration,
  period: { start: Date; end: Date },
  employees: NormalizedEmployee[],
  nodes: QuestionNode[],
  answers: Record<string, Answer>
): void {
  for (const node of nodes) {
    if (node.content === "Table") {
      // Handle table containers with dynamic row expansion
      processTableQuestion(node, declaration, period, employees, answers);
    } else {
      // Handle regular questions (global scope only)
      processRegularQuestion(node, employees, period, answers);
    }
    
    // Recurse into children (maintain hierarchy)
    processQuestionNodes(declaration, period, employees, node.children, answers);
  }
}

/**
 * Processes regular (non-table) questions that operate on global employee data.
 * These include global headcount, leavers, and turnover metrics.
 */
function processRegularQuestion(
  node: QuestionNode,
  employees: NormalizedEmployee[],
  period: { start: Date; end: Date },
  answers: Record<string, Answer>
): void {
  // Skip section headers (shouldn't reach here due to CSV filtering)
  if (node.id === "S1-6_01" || node.id === "S1-6_13") {
    return;
  }

  // Manual questions (methodology context)
  if (["S1-6_14", "S1-6_15", "S1-6_16", "S1-6_17"].includes(node.id)) {
    answers[node.id] = {
      value: null,
      source: "manual",
      explanation: ""
    };
    return;
  }

  // Global metrics (only computed for root-level questions)
  switch (node.id) {
    case "S1-6_02": // Global headcount (end)
      answers[node.id] = {
        ...computeHeadcountAtPeriodEnd(employees, period.end),
        source: "computed"
      };
      break;
      
    case "S1-6_03": // Global average headcount
      answers[node.id] = {
        ...computeAverageHeadcount(employees, period),
        source: "computed"
      };
      break;
      
    case "S1-6_11": // Global leavers
      answers[node.id] = {
        ...computeLeavers(employees, period),
        source: "computed"
      };
      break;
      
    case "S1-6_12": // Global turnover rate
      answers[node.id] = {
        ...computeTurnoverRate(employees, period),
        source: "computed"
      };
      break;
  }
}

/**
 * Processes table container questions with dynamic row expansion.
 * Generates multiple answers per table row using existing strategies.
 */
function processTableQuestion(
  tableNode: QuestionNode,
  declaration: Declaration,
  period: { start: Date; end: Date },
  employees: NormalizedEmployee[],
  answers: Record<string, Answer>
): void {
  switch (tableNode.id) {
    case "S1-6_04": // Employees by country
      processCountryTable(tableNode, employees, period, answers);
      break;
      
    case "S1-6_07": // Employees by gender
      //processGenderTable(tableNode, employees, period, answers);
      processContractGenderTable(tableNode, employees, period, answers);
      break;
      
    case "S1-6_08": // Employees by region (country fallback)
      processRegionTable(tableNode, employees, period, answers);
      break;
      
    case "S1-6_18": // Employees by professional category
      processCategoryTable(tableNode, employees, period, answers);
      break;
  }
}

/**
 * 🌍 COUNTRY TABLE PROCESSING
 * Groups employees by country and computes metrics per country.
 * Uses DSN field S21.G00.30.029 for country codes.
 */
function processCountryTable(
  tableNode: QuestionNode,
  employees: NormalizedEmployee[],
  period: { start: Date; end: Date },
  answers: Record<string, Answer>
): void {
  const countryGroups = groupByAttribute(employees, "country");
  
  for (const [country, countryEmployees] of Object.entries(countryGroups)) {
    if (country === "unknown") continue; // Skip invalid entries
    
    for (const child of tableNode.children) {
      const answerId = `${child.id}_${country}`;
      
      if (child.id === "S1-6_05") { // Headcount at period end
        const result = computeHeadcountAtPeriodEnd(countryEmployees, period.end);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Employees in country ${country}: ${result.value}`
        };
      } 
      else if (child.id === "S1-6_06") { // Average headcount
        const result = computeAverageHeadcount(countryEmployees, period);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Average employees in country ${country}: ${result.value}`
        };
      }
    }
  }
}

/**
 * 👥 GENDER TABLE PROCESSING  
 * Groups employees by gender and computes metrics per gender.
 * Uses DSN field S21.G00.30.005 for gender codes.
 */
function processGenderTable(
  tableNode: QuestionNode,
  employees: NormalizedEmployee[],
  period: { start: Date; end: Date },
  answers: Record<string, Answer>
): void {
  const genderGroups = groupByAttribute(employees, "gender");
  
  for (const [gender, genderEmployees] of Object.entries(genderGroups)) {
    if (gender === "unknown") continue;
    
    for (const child of tableNode.children) {
      const answerId = `${child.id}_${gender}`;
      
      if (child.id === "K_718") { // Headcount at period end
        const result = computeHeadcountAtPeriodEnd(genderEmployees, period.end);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Employees with gender code ${gender}: ${result.value}`
        };
      }
      else if (child.id === "K_719") { // Average headcount
        const result = computeAverageHeadcount(genderEmployees, period);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Average employees with gender code ${gender}: ${result.value}`
        };
      }
    }
  }
}




/**
 * CONTRACT-GENDER TABLE PROCESSING  
 * Groups employees by COMBINED gender + PCS-ESE (contract proxy).
 */
function processContractGenderTable(
  tableNode: QuestionNode,
  employees: NormalizedEmployee[],
  period: { start: Date; end: Date },
  answers: Record<string, Answer>
): void {
  // Create composite key: gender_pcsEse
  const contractGenderGroups: Record<string, NormalizedEmployee[]> = {};
  
  for (const emp of employees) {
    const gender = emp.gender || "unknown";
    const pcsEse = emp.pcsEse || "unknown";
    const compositeKey = `${gender}_${pcsEse}`;
    
    if (!contractGenderGroups[compositeKey]) {
      contractGenderGroups[compositeKey] = [];
    }
    contractGenderGroups[compositeKey].push(emp);
  }

  // Generate answers for each composite group
  for (const [compositeKey, groupEmployees] of Object.entries(contractGenderGroups)) {
    if (compositeKey === "unknown_unknown") continue;
    
    for (const child of tableNode.children) {
      const answerId = `${child.id}_${compositeKey}`;
      
      if (child.id === "K_718") { // End-of-period headcount
        const result = computeHeadcountAtPeriodEnd(groupEmployees, period.end);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Employees with gender/contract ${compositeKey}: ${result.value}`
        };
      }
      else if (child.id === "K_719") { // Average headcount
        const result = computeAverageHeadcount(groupEmployees, period);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Average employees with gender/contract ${compositeKey}: ${result.value}`
        };
      }
    }
  }
}





/**
 * REGION TABLE PROCESSING (ESRS COMPLIANT FALLBACK)
 * Since DSN doesn't provide regional data, we use country-as-region per ESRS S1-6-3.
 * Each country is treated as a separate region for compliance purposes.
 */
function processRegionTable(
  tableNode: QuestionNode,
  employees: NormalizedEmployee[],
  period: { start: Date; end: Date },
  answers: Record<string, Answer>
): void {
  // Use country groups as region groups (ESRS fallback)
  const regionGroups = groupByAttribute(employees, "country");
  
  for (const [region, regionEmployees] of Object.entries(regionGroups)) {
    if (region === "unknown") continue;
    
    for (const child of tableNode.children) {
      const answerId = `${child.id}_${region}`;
      
      if (child.id === "S1-6_09") { // Headcount at period end
        const result = computeHeadcountAtPeriodEnd(regionEmployees, period.end);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Employees in region ${region} (country-level fallback per ESRS S1-6-3): ${result.value}`
        };
      }
      else if (child.id === "S1-6_10") { // Average headcount
        const result = computeAverageHeadcount(regionEmployees, period);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Average employees in region ${region} (country-level fallback): ${result.value}`
        };
      }
    }
  }
}

/**
 * CATEGORY TABLE PROCESSING
 * Groups employees by professional category (PCS-ESE code).
 * Uses DSN field S21.G00.40.004 for category codes.
 */
function processCategoryTable(
  tableNode: QuestionNode,
  employees: NormalizedEmployee[],
  period: { start: Date; end: Date },
  answers: Record<string, Answer>
): void {
  const categoryGroups = groupByAttribute(employees, "pcsEse");
  
  for (const [category, categoryEmployees] of Object.entries(categoryGroups)) {
    if (category === "unknown") continue;
    
    for (const child of tableNode.children) {
      const answerId = `${child.id}_${category}`;
      
      if (child.id === "S1-6_19") { // Headcount at period end
        const result = computeHeadcountAtPeriodEnd(categoryEmployees, period.end);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Employees in professional category ${category}: ${result.value}`
        };
      }
      else if (child.id === "S1-6_20") { // Average headcount
        const result = computeAverageHeadcount(categoryEmployees, period);
        answers[answerId] = {
          ...result,
          source: "computed",
          explanation: `Average employees in professional category ${category}: ${result.value}`
        };
      }
    }
  }
}