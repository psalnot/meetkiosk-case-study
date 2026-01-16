// test/unit/matching/compute-answers.country.test.ts
import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseDsnFile } from "~/utils/dsn-parser/parser.server";
import fs from "fs";
import path from "path";

// Helper to clear module cache with absolute paths
function clearModuleCache(relativePath: string) {
  const absolutePath = resolve(__dirname, relativePath);
  if (require.cache[absolutePath]) {
    delete require.cache[absolutePath];
  }
}

describe("Employees by Country (S1-6_04)", () => {
  const dsnContent = fs.readFileSync(
    path.resolve(__dirname, "../../../fixtures/dsn-country-minimal.txt"),
    "utf-8"
  );

  it("computes country-specific headcount correctly", async () => {
    // Set env var BEFORE importing loader
    process.env.QUESTIONS_CSV_PATH = resolve(__dirname, "../../../fixtures/questions-valid.csv");
    
    // Clear module cache using relative paths from test file
    clearModuleCache("../../../../app/utils/questions/loader.server");
    clearModuleCache("../../../../app/config/questions");
    
    // Dynamically import AFTER setting env var
    const { loadQuestionsFromCsv } = await import("~/utils/questions/loader.server");
    const { computeAnswers } = await import("~/utils/matching/index.server");
    
    const declaration = await parseDsnFile(dsnContent);
    const questionTree = loadQuestionsFromCsv();
    const answers = computeAnswers(declaration, questionTree);
    
    /*console.log("=== DECLARATION ===");
    console.log(JSON.stringify(declaration, null, 2));
    
    console.log("=== QUESTION TREE (first few nodes) ===");
    console.log(JSON.stringify(questionTree.slice(0, 3), null, 2));
    
    console.log("=== ALL ANSWER KEYS ===");
    console.log(Object.keys(answers));
    
    console.log("=== SPECIFIC ANSWERS ===");
    console.log("S1-6_05_FR:", answers["S1-6_05_FR"]);
    console.log("S1-6_05_IR:", answers["S1-6_05_IR"]);
    console.log("S1-6_06_FR:", answers["S1-6_06_FR"]);
    console.log("S1-6_06_IR:", answers["S1-6_06_IR"]);*/
    

    expect(answers["S1-6_05_FR"]).toEqual({
      value: 1,
      source: "computed",
      explanation: "Employees in country FR: 1"
    });
    
    expect(answers["S1-6_06_IR"]).toEqual({
      value: 3,
      source: "computed",
      explanation: "Average employees in country IR: 3"
    });

    expect(answers["S1-6_06_FR"]).toEqual({
      value: 1.5,
      source: "computed",
      explanation: "Average employees in country FR: 1.5"
    });
    
    const countryKeys = Object.keys(answers).filter(k => k.startsWith("S1-6_05_"));
    expect(countryKeys).toContain("S1-6_05_FR");
    expect(countryKeys).toContain("S1-6_05_IR");
  });
});