/** True under Vitest/Node test runs. Used to force side-effect-free adapters. */
export function isTestRunner(): boolean {
  return Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";
}
