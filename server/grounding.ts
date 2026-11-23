import { parseOrganizeResult, type OrganizeRequest } from '../shared/ai';

/** Validate references before filtering: duplicates and invalid indices are never silently accepted. */
export function groundOrganizeResult(raw: unknown, request: OrganizeRequest) {
  const result = parseOrganizeResult(raw, request.questions.length);
  const selected = new Set(request.selectedQuestions);
  return {...result, recommendedQuestions: result.recommendedQuestions.filter(q => !selected.has(request.questions[q.sourceIndex]))};
}
