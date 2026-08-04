export function firstRowPerMode<T extends { mode: string }>(rows: readonly T[]): T[] {
  const firstRows = new Map<string, T>();
  for (const row of rows) {
    if (!firstRows.has(row.mode)) firstRows.set(row.mode, row);
  }
  return [...firstRows.values()];
}
