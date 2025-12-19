/**
 * Query Timeout Utility
 * Wraps async operations with a timeout to prevent infinite spinners
 * Critical for production reliability
 */

export class QueryTimeoutError extends Error {
  constructor(message: string = 'Query timed out - please try again') {
    super(message);
    this.name = 'QueryTimeoutError';
  }
}

/**
 * Wraps an async function with a timeout
 * Throws QueryTimeoutError if the operation takes longer than timeoutMs
 * 
 * @param queryFn - The async function to execute
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 10000)
 * @returns The result of the query function
 * @throws QueryTimeoutError if timeout is exceeded
 */
export async function queryWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new QueryTimeoutError(`Request timed out after ${timeoutMs / 1000} seconds`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Wraps a Supabase query with timeout and returns a standardized result
 * Returns { data, error, timedOut } for easier error handling
 */
export async function supabaseQueryWithTimeout<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number = 10000
): Promise<{ data: T | null; error: any; timedOut: boolean }> {
  try {
    const result = await queryWithTimeout(queryFn, timeoutMs);
    return { ...result, timedOut: false };
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      console.error('[QueryTimeout]', error.message);
      return { 
        data: null, 
        error: { message: error.message, code: 'TIMEOUT' }, 
        timedOut: true 
      };
    }
    // Re-throw non-timeout errors
    throw error;
  }
}
