
import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseDsnFile } from "~/utils/dsn-parser/parser.server";
import fs from "fs";
import path from "path";

function clearModuleCache(relativePath: string) {
  const absolutePath = resolve(__dirname, relativePath);
  if (require.cache[absolutePath]) {
    delete require.cache[absolutePath];
  }
}

describe("Employees by Category (S1-6_18)", () => {
  const dsnContent = fs.readFileSync(
    path.resolve(__dirname, "../../../fixtures/dsn-category-minimal.txt"),
    "utf-8"
  );

  it("computes category-based headcount correctly", async () => {
    process.env.QUESTIONS_CSV_PATH = resolve(__dirname, "../../../fixtures/questions-valid.csv");
    
    clearModuleCache("../../../../app/utils/questions/loader.server");
    clearModuleCache("../../../../app/config/questions");
    
    const { loadQuestionsFromCsv } = await import("~/utils/questions/loader.server");
    const { computeAnswers } = await import("~/utils/matching/index.server");
    
    const declaration = await parseDsnFile(dsnContent);
    const questionTree = loadQuestionsFromCsv();
    const answers = computeAnswers(declaration, questionTree);


    console.log("=== DECLARATION ===");
    console.log(JSON.stringify(declaration, null, 2));
    
    console.log("=== QUESTION TREE (first few nodes) ===");
    console.log(JSON.stringify(questionTree.slice(0, 3), null, 2));
    
    console.log("=== ALL ANSWER KEYS ===");
    console.log(Object.keys(answers));
    
    console.log("=== SPECIFIC ANSWERS ===");
    console.log("S1-6_19_6220:", answers["S1-6_19_6220"]);
    console.log("S1-6_19_3855:", answers["S1-6_19_3855"]);
    console.log("S1-6_20_3855:", answers["S1-6_20_3855"]);
    //console.log("S1-6_06_IR:", answers["S1-6_06_IR"]);
    
    //  End-of-period headcount by category
    expect(answers["S1-6_19_3855"]).toEqual({
      value: 1,
      source: "computed",
      explanation: "Employees in professional category 3855: 1"
    });
    
    expect(answers["S1-6_19_6220"]).toEqual({
      value: 1,
      source: "computed", 
      explanation: "Employees in professional category 6220: 1"
    });
    
    //  Average headcount by category  
    expect(answers["S1-6_20_3855"]).toEqual({
      value: 1,
      source: "computed",
      explanation: "Average employees in professional category 3855: 1"
    });
    
    expect(answers["S1-6_20_6220"]).toEqual({
      value: 1,
      source: "computed",
      explanation: "Average employees in professional category 6220: 1"
    });
    
    //erify dynamic keys exist
    const categoryKeys = Object.keys(answers);
    expect(categoryKeys).toContain("S1-6_19_3855");
    expect(categoryKeys).toContain("S1-6_19_6220");
    expect(categoryKeys).toContain("S1-6_20_3855");
    expect(categoryKeys).toContain("S1-6_20_6220");
  });
});
