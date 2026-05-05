# Quiet Current — Agentic Reflection Platform

## Positioning

Quiet Current is a premium local-first reflection platform with agentic messaging. The product combines journaling, short practices, AI-guided reflection, configurable guide personas, weekly summaries, and privacy controls into one cohesive calm interface.

## What It Demonstrates

- Product judgment: the app prioritizes one calm action at a time instead of dashboard clutter.
- Frontend craft: responsive premium UI, structured CSS, consistent interaction states, and polished empty/success states.
- Full-stack implementation: React frontend, Express API, SQLite persistence, AI provider abstraction, prompt orchestration, and test coverage.
- AI product thinking: guide personas, prompt composition, fallback behavior, boundaries, and explicit local-first privacy cues.
- Design systems mindset: reusable visual language, stable spacing, card hierarchy, and documented design tokens.

## Core User Flows

1. Open Today and start a practice, journal entry, guided chat, or weekly review.
2. Use Practice to filter short reset practices and run an immersive timed session.
3. Use Journal to capture notes, gratitude, reflections, intentions, and ideas.
4. Use Guide to have a private AI-guided conversation.
5. Use Guide Builder to create custom guide personas.
6. Generate a Weekly Review from local activity and save it to the journal.
7. Use Privacy controls to export or delete local data.

## Engineering Notes

- The project is intentionally local-first.
- SQLite is used for app data.
- AI providers are abstracted behind `server/aiProvider.js`.
- The default chat provider is Ollama.
- OpenAI-compatible providers are supported through environment variables.

## Suggested Resume Bullet

Built Quiet Current, a local-first React/TypeScript agentic reflection platform with Express, SQLite, configurable AI guide personas, journaling, guided practices, weekly reviews, and a premium responsive UI, emphasizing privacy, prompt orchestration, automated quality gates, and full-stack product execution.
