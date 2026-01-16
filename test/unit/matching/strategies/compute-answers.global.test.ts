// test/unit/matching/compute-answers.global.test.ts
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

describe("Global Employees (S1-6_01)", () => {
  const dsnContent = fs.readFileSync(
    path.resolve(__dirname, "../../../fixtures/dsn-global-minimal.txt"),
    "utf-8"
  );

  it("computes global headcount metrics correctly", async () => {
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
    
    //  Global end-of-period headcount (S1-6_02)
    expect(answers["S1-6_02"]).toEqual({
      value: 4,
      source: "computed",
      explanation: expect.stringContaining("4 employees with active contracts as of 2025-11-30")
    });
    
    //  Global average headcount (S1-6_03)
    expect(answers["S1-6_03"]).toEqual({
      value: 4.5,
      source: "computed",
      explanation: expect.stringContaining("Average employees")
    });
    
    // Employee leavers (S1-6_11)
    expect(answers["S1-6_11"]).toEqual({
      value: 1,
      source: "computed",
      explanation: expect.stringContaining("1 employee left between 2025-11-01 and 2025-11-30")
    });
    
    // Turnover rate (S1-6_12)
    expect(answers["S1-6_12"]).toEqual({
      value: 20, // (1 leaver / 5 peak employees) * 100 = 20%
      source: "computed",
      explanation: expect.stringContaining("Turnover rate")
    });
  });
});