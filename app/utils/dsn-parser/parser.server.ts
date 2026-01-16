import { DSNFileReader, DSNDataReader } from "./dsn-reader.server";
import { hasRequiredBlocks } from "./conformity.server";

export async function parseDsnFile(content: string) {
  // Step 1: Conformity check
  if (!hasRequiredBlocks(content)) {
    throw new Error("Invalid DSN: missing required S10, S20, or S21 block.");
  }

  // Step 2: Full parsing
  const dataDSN = await DSNFileReader(content);
  const declaration = await DSNDataReader(dataDSN);

  if (!declaration.validStatement) {
    throw new Error("DSN contains structural errors.");
  }

  return declaration;
}
