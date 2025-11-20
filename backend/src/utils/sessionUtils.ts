/**
 * Check if a session ID indicates a practice session
 * Practice sessions have IDs starting with "practice_"
 */
export function isPracticeSession(sessionId: string): boolean {
  return sessionId.startsWith('practice_');
}
