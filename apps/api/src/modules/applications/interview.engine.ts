/**
 * Interview coaching heuristics. These are *coaching indicators*, not exact
 * measurements — the UI labels them that way. When an AI model is available it
 * may refine feedback, but this deterministic baseline always works.
 */
import { randomUUID } from 'node:crypto';
import type { InterviewQuestion, InterviewScores } from '@orbit/shared';
import { detectSkills } from '../skills/skill-matcher';

const ROLE_QUESTIONS: Record<string, { question: string; focus: string }[]> = {
  'product-manager': [
    { question: 'Pick a product you use every day. How would you improve it, and how would you know the change worked?', focus: 'Product sense' },
    { question: 'Daily active users dropped 10% last week. Walk me through how you would investigate.', focus: 'Product analytics' },
    { question: 'Engineering says a feature will take three months, but sales needs it in one. What do you do?', focus: 'Stakeholder management' },
    { question: 'How would you decide what goes into the next quarter’s roadmap?', focus: 'Prioritisation' },
  ],
  'software-engineer': [
    { question: 'Explain how you would design a URL shortener that handles millions of requests per day.', focus: 'System design' },
    { question: 'Tell me about a bug that was hard to track down. How did you find and fix it?', focus: 'Debugging' },
    { question: 'How do you decide what to test in a new feature?', focus: 'Testing' },
    { question: 'Describe a time you received tough code review feedback. What did you change?', focus: 'Collaboration' },
  ],
  'ai-engineer': [
    { question: 'How would you evaluate whether an LLM-based assistant is good enough to ship?', focus: 'Evaluation' },
    { question: 'When would you use retrieval-augmented generation instead of fine-tuning?', focus: 'LLM applications' },
    { question: 'Walk me through an ML project you built end to end. What would you do differently?', focus: 'Project depth' },
    { question: 'A model performs well offline but poorly in production. What could be happening?', focus: 'MLOps' },
  ],
  'data-analyst': [
    { question: 'Write, in words, the SQL you would use to find the weekly retention of new users.', focus: 'SQL' },
    { question: 'A stakeholder asks why revenue dropped. How do you structure your analysis?', focus: 'Analytical thinking' },
    { question: 'How do you explain a statistically insignificant result to a non-technical manager?', focus: 'Communication' },
    { question: 'Tell me about a dashboard you built. Who used it and what decisions did it drive?', focus: 'Impact' },
  ],
  'ux-designer': [
    { question: 'Walk me through a design project from research to final solution.', focus: 'Design process' },
    { question: 'How do you decide which usability problems to fix first?', focus: 'Prioritisation' },
    { question: 'Tell me about a time research changed your design direction.', focus: 'User research' },
    { question: 'How do you work with engineers when a design is hard to build?', focus: 'Collaboration' },
  ],
};

const BEHAVIOURAL = [
  { question: 'Tell me about a time you led a team through a difficult situation. What was the result?', focus: 'Leadership' },
  { question: 'Why do you want this role, and why at this company?', focus: 'Motivation' },
];

export function templateQuestions(roleSlug: string, company: string | null, gaps: string[]): InterviewQuestion[] {
  const role = ROLE_QUESTIONS[roleSlug] ?? ROLE_QUESTIONS['product-manager'];
  const picked = [BEHAVIOURAL[0], ...role.slice(0, 3)];
  if (gaps[0]) picked.push({ question: `How have you been building your ${gaps[0]} skills, and how would you apply them in your first month?`, focus: gaps[0] });
  picked.push({
    question: company ? `Why do you want to join ${company}, and what would you want to learn there?` : BEHAVIOURAL[1].question,
    focus: 'Motivation',
  });
  return picked.slice(0, 5).map((q) => ({ id: randomUUID(), question: q.question, focus: q.focus, answer: null, feedback: null }));
}

const HEDGES = /\b(maybe|i think|i guess|not sure|kind of|sort of|probably|i don't know|perhaps)\b/gi;
const STRUCTURE = /\b(situation|task|action|result|first|second|then|finally|because|so that|as a result|outcome)\b/gi;
const EXAMPLES = /(\d+%|\d+\s?(users|people|members|students|merchants|percent|x|times|weeks|days)|for example|for instance|i led|i built|i designed|i ran|we launched)/gi;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function scoreAnswer(answer: string, roleTerms: string[]): InterviewScores {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const wc = words.length;
  const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
  const avgSentence = wc / sentences;
  const hedges = answer.match(HEDGES)?.length ?? 0;
  const structure = new Set((answer.match(STRUCTURE) ?? []).map((m) => m.toLowerCase())).size;
  const examples = answer.match(EXAMPLES)?.length ?? 0;
  const lower = answer.toLowerCase();
  const termHits = roleTerms.filter((t) => lower.includes(t)).length + detectSkills(answer).length;

  return {
    communication: clamp((wc >= 60 ? 70 : wc >= 30 ? 55 : 35) + (avgSentence >= 8 && avgSentence <= 28 ? 20 : 5) - hedges * 4),
    structure: clamp(35 + structure * 12),
    roleKnowledge: clamp(30 + termHits * 12),
    examples: clamp(30 + examples * 20),
    confidence: clamp(85 - hedges * 12 - (wc < 25 ? 20 : 0)),
  };
}

export function averageScores(all: InterviewScores[]): InterviewScores {
  const keys: (keyof InterviewScores)[] = ['communication', 'structure', 'roleKnowledge', 'examples', 'confidence'];
  if (all.length === 0) return { communication: 0, structure: 0, roleKnowledge: 0, examples: 0, confidence: 0 };
  return Object.fromEntries(keys.map((k) => [k, clamp(all.reduce((s, x) => s + x[k], 0) / all.length)])) as unknown as InterviewScores;
}

export function feedbackFor(scores: InterviewScores): string {
  const tips: string[] = [];
  if (scores.structure < 60) tips.push('Structure the answer with Situation, Task, Action and Result.');
  if (scores.examples < 60) tips.push('Add a concrete example with a number — users, percentages or time saved.');
  if (scores.roleKnowledge < 55) tips.push('Use the language of the role: metrics, trade-offs and the tools you used.');
  if (scores.confidence < 65) tips.push('Replace hedging phrases like “I think” or “maybe” with clear statements.');
  if (scores.communication < 60) tips.push('Aim for 60–150 words: enough detail, still concise.');
  return tips.length ? tips.join(' ') : 'Strong answer: clear structure, concrete evidence and role-specific language.';
}

export function weakestDimension(scores: InterviewScores): { key: keyof InterviewScores; label: string } {
  const labels: Record<keyof InterviewScores, string> = {
    communication: 'Communication',
    structure: 'Answer Structure',
    roleKnowledge: 'Role Knowledge',
    examples: 'Concrete Examples',
    confidence: 'Confidence',
  };
  const key = (Object.keys(scores) as (keyof InterviewScores)[]).sort((a, b) => scores[a] - scores[b])[0];
  return { key, label: labels[key] };
}
