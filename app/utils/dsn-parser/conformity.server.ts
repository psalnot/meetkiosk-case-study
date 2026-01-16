/**
 * Performs a lightweight pre-validation of a DSN file.
 *
 * Checks for the presence of mandatory DSN blocks (S10, S20, S21)
 * before running the full parsing logic.
 *
 * Note: This does NOT validate the structure or correctness of the blocks,
 * only their presence.
 */

export function hasRequiredBlocks(content: string): boolean {
  const lines = content.split('\n');
  const hasS10 = lines.some(line => /^S10\./.test(line));
  const hasS20 = lines.some(line => /^S20\./.test(line));
  const hasS21 = lines.some(line => /^S21\./.test(line));
  return hasS10 && hasS20 && hasS21;
}
