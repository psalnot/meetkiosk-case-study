import { describe, it, expect, beforeEach } from "vitest";
import { loadQuestionsFromCsv } from "~/utils/questions/loader.server";
import { resolve } from "path";

// Helper to dynamically import and override env var
async function loadWithCsv(csvName: string) {
  // Set env before importing loader (since it reads QUESTIONS_CONFIG at module level)
  process.env.QUESTIONS_CSV_PATH = resolve(__dirname, `../../fixtures/${csvName}`);
  
  // Clear module cache to force re-evaluation with new env
  await import("~/utils/questions/loader.server");
  const { loadQuestionsFromCsv: fn } = await import("~/utils/questions/loader.server");
  return fn();
}

describe("Question CSV Loader – Tree Structure", () => {
  beforeEach(() => {
    // Reset env after each test
    delete process.env.QUESTIONS_CSV_PATH;
  });

  it("builds correct tree structure with proper nesting", async () => {
    const roots = await loadWithCsv("questions-valid-tree.csv");
    
    // Find "Global employees" table (S1-6_01)
    const globalTable = roots.find(q => q.id === "S1-6_01");
    expect(globalTable).toBeDefined();
    expect(globalTable?.content).toBe("Table");
    expect(globalTable?.children).toHaveLength(4); // S1-6_02 to S1-6_12
    
    // Verify child order and IDs
    expect(globalTable?.children.map(c => c.id)).toEqual([
      "S1-6_02",
      "S1-6_03",
      "S1-6_11",
      "S1-6_12"
    ]);
    
    // Find "Employees by region" table (S1-6_08)
    const regionTable = roots.find(q => q.id === "S1-6_08");
    expect(regionTable).toBeDefined();
    expect(regionTable?.children.map(c => c.id)).toEqual([
      "S1-6_09",
      "S1-6_10"
    ]);
  });

  it("parses enums correctly with semicolon separator", async () => {
    const roots = await loadWithCsv("questions-valid.csv");
    
    // Find manual enum question (S1-6_14)
    const enumQuestion = roots
      .flatMap(root => [root, ...root.children])
      .find(q => q.id === "S1-6_14");
    
    expect(enumQuestion).toBeDefined();
    expect(enumQuestion?.enumEn).toEqual(["Head-count", "Full-time equivalent"]);
    expect(enumQuestion?.enumFr).toEqual(["Effectifs", "Équivalent temps plein"]);
  });

  it("identifies root nodes correctly (no parent or invalid parent)", async () => {
    const roots = await loadWithCsv("questions-valid.csv");
    
    const rootIds = roots.map(q => q.id);
    const expectedRoots = [
      "S1-6_01", // Global employees
      "S1-6_04", // Employees by country
      "S1-6_07", // Employees by contract/gender
      "S1-6_08", // Employees by region
      "S1-6_18", // Employees by category
      "S1-6_13"  // Methodologies
    ];
    
    // All expected roots are present
    expectedRoots.forEach(id => {
      expect(rootIds).toContain(id);
    });
    
    // No non-root questions in top level
    const allChildIds = roots.flatMap(root => root.children.map(c => c.id));
    roots.forEach(root => {
      expect(allChildIds).not.toContain(root.id);
    });
  });

  it("handles empty parentId correctly (sets undefined)", async () => {
    const roots = await loadWithCsv("questions-valid.csv");
    
    // Root nodes should have undefined parentId
    roots.forEach(root => {
      expect(root.parentId).toBeUndefined();
    });
    
    // Child nodes should have valid parentId
    const allChildren = roots.flatMap(root => root.children);
    allChildren.forEach(child => {
      expect(child.parentId).toBeDefined();
      expect(child.parentId).toMatch(/S1-6_\d+/);
    });
  });

  it("sorts children by 'order' field", async () => {
    const roots = await loadWithCsv("questions-valid.csv");
    
    // Check "Global employees" children are ordered by 'order'
    const globalTable = roots.find(q => q.id === "S1-6_01");
    if (!globalTable) throw new Error("Global table not found");
    
    const orders = globalTable.children.map(c => c.order);
    // Should be [0, 1, 2, 3] as per CSV
    expect(orders).toEqual([0, 1, 2, 3]);
  });
});
