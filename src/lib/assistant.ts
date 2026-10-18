/** Imperative messages ("add…", "pay…", "delete…") are assistant commands, not questions. Shared by server and the demo chat. */
export function looksLikeCommand(message: string): boolean {
  return /^(?:please\s+)?(?:add|create|new|set|change|update|rename|edit|delete|remove|pay|pause|resume|record|log|contribute|put|move|switch|turn|mark|open|go to|take me|plan)\b/i.test(message.trim());
}
