/**
 * Admin test token for funnel demo - bypasses DB lookup when no professional has this token.
 * Used by Test Funnel button in Admin Dashboard.
 */
export const ADMIN_TEST_TOKEN = 'ee5a75fc-2a6e-4a03-980e-f40532c55f59';

export function isAdminTestToken(token: string | undefined): boolean {
  return token === ADMIN_TEST_TOKEN;
}

export function getAdminTestProfessional<T extends Record<string, unknown>>(
  overrides: Partial<T> = {}
): T {
  return {
    id: 'admin-test',
    name: 'Test User (Admin Demo)',
    email: 'admin@top10lists.us',
    phone: null,
    company: null,
    website: null,
    license_number: null,
    years_experience: null,
    ...overrides,
  } as T;
}
