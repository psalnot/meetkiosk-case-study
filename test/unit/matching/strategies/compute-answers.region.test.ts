// test/unit/matching/compute-answers.region.test.ts
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

describe("Employees by Region (S1-6_08)", () => {
  const dsnContent = fs.readFileSync(
    path.resolve(__dirname, "../../../fixtures/dsn-region-minimal.txt"),
    "utf-8"
  );

  it("computes region-specific headcount correctly", async () => {
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
    
    //  Region end-of-period headcount (S1-6_09)
    expect(answers["S1-6_09_FR"]).toEqual({
      value: 2,
      source: "computed",
      explanation: "Employees in region FR (country-level fallback per ESRS S1-6-3): 2"
    });
    
    expect(answers["S1-6_09_IR"]).toEqual({
      value: 3,
      source: "computed",
      explanation: "Employees in region IR (country-level fallback per ESRS S1-6-3): 3"
    });
    
    //  Region average headcount (S1-6_10)
    expect(answers["S1-6_10_FR"]).toEqual({
      value: 2,
      source: "computed",
      explanation: "Average employees in region FR (country-level fallback): 2"
    });
    
    expect(answers["S1-6_10_IR"]).toEqual({
      value: 3,
      source: "computed",
      explanation: "Average employees in region IR (country-level fallback): 3"
    });
    
    //  Verify dynamic keys exist
    const regionKeys = Object.keys(answers);
    expect(regionKeys).toContain("S1-6_09_FR");
    expect(regionKeys).toContain("S1-6_09_IR");
    expect(regionKeys).toContain("S1-6_10_FR");
    expect(regionKeys).toContain("S1-6_10_IR");
  });
});
