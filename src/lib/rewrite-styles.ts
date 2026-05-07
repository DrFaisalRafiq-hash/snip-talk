// Mirrors the styles in the expand-text edge function. The server is the source
// of truth for the actual prompt — this list is just for the picker UI.

export type RewriteStyle = {
  id: string;
  label: string;
  hint: string;
};

export const REWRITE_STYLES: RewriteStyle[] = [
  { id: "email-formal", label: "Email · Formal", hint: "Polished business email with subject" },
  { id: "email-concise", label: "Email · Concise", hint: "Under 80 words, direct" },
  { id: "email-friendly", label: "Email · Friendly", hint: "Warm, conversational" },
  { id: "instructions", label: "Instructions", hint: "Numbered step-by-step" },
  { id: "bullets", label: "Bullets", hint: "3–7 tight bullet points" },
  { id: "meeting", label: "Meeting notes", hint: "Decisions, actions, questions" },
  { id: "slack", label: "Slack message", hint: "Short, scannable, friendly" },
  { id: "polish", label: "Polish", hint: "Light edit, same meaning" },
  { id: "expand", label: "Expand", hint: "Terse → full prose" },
];

export const DEFAULT_REWRITE_STYLE_ID = "polish";
