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

describe("Employees by Contract and Gender (S1-6_07)", () => {
  const dsnContent = fs.readFileSync(
    path.resolve(__dirname, "../../../fixtures/dsn-gender-contract-minimal.txt"),
    "utf-8"
  );

  it("computes contract-gender headcount correctly", async () => {
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
    console.log("K_718_M_3855:", answers["K_718_M_3855"]);
    console.log("K_718_F_6220:", answers["K_718_F_6220"]);
    
    
    //  End-of-period headcount by contract+gender
    // Assuming PCS-ESE 3855 = "Manager", 6220 = "Technician"
    expect(answers["K_718_M_3855"]).toEqual({
      value: 1,
      source: "computed",
      explanation: "Employees with gender/contract M_3855: 1"
    });
    
    expect(answers["K_718_F_6220"]).toEqual({
      value: 1,
      source: "computed", 
      explanation: "Employees with gender/contract F_6220: 1"
    });
    
    //  Average headcount by contract+gender  
    expect(answers["K_719_M_3855"]).toEqual({
      value: 1,
      source: "computed",
      explanation: "Average employees with gender/contract M_3855: 1"
    });
    
    expect(answers["K_719_F_6220"]).toEqual({
      value: 1,
      source: "computed",
      explanation: "Average employees with gender/contract F_6220: 1"
    });
    
    // ✅ Verify dynamic keys exist
    const contractGenderKeys = Object.keys(answers).filter(k => k.startsWith("K_718_") || k.startsWith("K_719_"));
    expect(contractGenderKeys).toContain("K_718_M_3855");
    expect(contractGenderKeys).toContain("K_718_F_6220");
    expect(contractGenderKeys).toContain("K_719_M_3855");
    expect(contractGenderKeys).toContain("K_719_F_6220");
  });
});
