import { uniqueQuestions, type OrganizeResult } from '../../shared/ai';

/** Selected-only legacy records join the library in their existing order; storage keys stay unchanged. */
export function questionCollection(saved: string[] = [], selected: string[] = []) {
  const questions = uniqueQuestions([...saved, ...selected]);
  const selectedQuestions = uniqueQuestions(selected);
  const selectedSet = new Set(selectedQuestions);
  return {questions, selectedQuestions, pending: questions.filter(q => !selectedSet.has(q))};
}
export function selectQuestion(saved: string[], selected: string[], question: string, include: boolean) {
  const collection = questionCollection(saved, selected);
  return {
    savedDoctorQuestions: collection.questions,
    nextClinicQuestions: include ? uniqueQuestions([...collection.selectedQuestions, question]) : collection.selectedQuestions.filter(q => q !== question),
  };
}
export function recommendationTags(result: OrganizeResult, sources: string[], selected: string[]) {
  const selectedSet = new Set(selected);
  return new Map(result.recommendedQuestions.flatMap(item => {
    const question = sources[item.sourceIndex];
    return question && !selectedSet.has(question) ? [[question, item.categoryTag] as const] : [];
  }));
}
export function questionSignatures(questions: string[], selected: string[]) {
  return {content: JSON.stringify(questions), selection: JSON.stringify(selected)};
}
export function analysisInvalidated(previous: ReturnType<typeof questionSignatures>, next: ReturnType<typeof questionSignatures>, pending: boolean) {
  return previous.content !== next.content || (pending && previous.selection !== next.selection);
}
