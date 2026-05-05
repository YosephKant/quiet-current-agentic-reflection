/**
 * Seeded into SQLite on first run; `seedExtraPractices` appends new titles to existing DBs.
 * Tags support filtering (e.g. anxiety, sleep, short) and Home heuristics. Summaries are original.
 */
export const PRACTICES_CATALOG = [
  {
    title: "Sitting without a goal",
    summary:
      "Sit to simply be present, without trying to ‘get’ calm or a special state. When striving drops, the mind can rest naturally.",
    category: "zen",
    tags: ["seated", "beginner", "anxiety", "10"],
    est_minutes: 10,
  },
  {
    title: "The gap between thoughts",
    summary:
      "Notice the brief space when one thought ends and another has not yet started. Rest attention there, lightly and without forcing.",
    category: "inquiry",
    tags: ["inquiry", "beginner", "calm", "5"],
    est_minutes: 5,
  },
  {
    title: "Body scan",
    summary:
      "From toes to head, or head to toes, feel sensation as it is—tingling, pressure, temperature—without fixing a story about it.",
    category: "vipassana",
    tags: ["body", "sleep", "tension", "15"],
    est_minutes: 15,
  },
  {
    title: "Breath as anchor",
    summary:
      "Follow the natural breath. When the mind wanders, return with kindness, as you would guide a small child back to the path.",
    category: "samatha",
    tags: ["breath", "anxiety", "beginner", "10"],
    est_minutes: 10,
  },
  {
    title: "Metta in three lines",
    summary:
      "Offer gentle phrases: may I be safe, may I be at ease, may I meet what arises with clarity. Then extend the same to a good friend, then someone neutral.",
    category: "loving_kindness",
    tags: ["compassion", "anxiety", "5"],
    est_minutes: 5,
  },
  {
    title: "Who is aware?",
    summary:
      "When lost in a thought, ask softly: who or what is aware of this thought? This is not a riddle to solve; it loosens identification with the narrator.",
    category: "inquiry",
    tags: ["inquiry", "5"],
    est_minutes: 5,
  },
  {
    title: "Listening as meditation",
    summary:
      "Let sounds arise and pass. Listen without hunting for ‘good’ or ‘bad’ sound—hearing as an open field, like rain on a roof.",
    category: "insight",
    tags: ["open", "calm", "10"],
    est_minutes: 10,
  },
  {
    title: "Walking with attention",
    summary:
      "Walk slowly. Feel the shifting of weight, contact with the ground, the swing of the limbs. One step, then the next, fully allowed.",
    category: "mindfulness",
    tags: ["walking", "short", "10"],
    est_minutes: 10,
  },
  {
    title: "Gratitude for the ordinary",
    summary:
      "Name three small things from today: warmth, a meal, a person, light through a window. Specific gratitude grounds the mind in the actual.",
    category: "gratitude",
    tags: ["gratitude", "5"],
    est_minutes: 5,
  },
  {
    title: "Let the mud settle",
    summary:
      "When the mind is stirred, you need not fix it. Allow agitation to run its course; stillness may return the way a pond clears when left undisturbed.",
    category: "zen",
    tags: ["anxiety", "seated", "10"],
    est_minutes: 10,
  },
  {
    title: "4-7-8 breath (gentle variant)",
    summary:
      "Inhale for four, pause softly for seven, exhale for eight—only as far as is comfortable, never straining. A few cycles can soften the nervous system; skip if you feel lightheaded.",
    category: "samatha",
    tags: ["breath", "anxiety", "short", "5"],
    est_minutes: 5,
  },
  {
    title: "Labeling without fixing",
    summary:
      "When a mood appears, add a small label: planning, worry, memory. The label is not a verdict; it is a place to set the experience down, lightly.",
    category: "vipassana",
    tags: ["anxiety", "5"],
    est_minutes: 5,
  },
  {
    title: "Hand on heart, soft breath",
    summary:
      "Rest a warm hand on the chest. Breathe as if the breath could widen the room behind the sternum, without forcing depth. Simple contact can remind the body it is not alone in the room.",
    category: "loving_kindness",
    tags: ["anxiety", "body", "5"],
    est_minutes: 5,
  },
  {
    title: "Open awareness sit",
    summary:
      "Sit and let the field of experience be wide: sight at the edge, sound, touch. When attention narrows on a thought, don’t scold; widen again, as if the sky included the cloud.",
    category: "insight",
    tags: ["seated", "10"],
    est_minutes: 10,
  },
  {
    title: "Micro-pause at the red light",
    summary:
      "At the next stop or queue, don’t turn to a screen. Feel the soles of the feet, one breath, one sense of not needing the moment to be different. Then continue.",
    category: "mindfulness",
    tags: ["short", "everyday", "1"],
    est_minutes: 1,
  },
  {
    title: "Loving speech inward",
    summary:
      "Silently say something you would offer a good friend: may this trouble not be a verdict on you. The words do not have to be believed fully; they soften the internal voice.",
    category: "loving_kindness",
    tags: ["compassion", "anxiety", "5"],
    est_minutes: 5,
  },
  {
    title: "Sound as the bell of now",
    summary:
      "Use the next unplanned sound—a door, a bird, traffic—as a small bell. For one or two seconds, do nothing but hear it, without a story. Then return to the day.",
    category: "insight",
    tags: ["short", "2"],
    est_minutes: 2,
  },
  {
    title: "Lying down body kindness",
    summary:
      "Lie on your back; scan for one area of unnecessary tension. Instead of releasing by force, imagine breath or warmth visiting that place for three slow breaths.",
    category: "vipassana",
    tags: ["body", "sleep", "10"],
    est_minutes: 10,
  },
  {
    title: "RAIN in brief",
    summary:
      "Recognize what is present, Allow it to be, Investigate in the body (where, how big), and Nurture with a single kind phrase. Rest there without solving the week.",
    category: "loving_kindness",
    tags: ["anxiety", "inquiry", "5"],
    est_minutes: 5,
  },
  {
    title: "Sitting with impermanence, lightly",
    summary:
      "Watch one sensation—tingling, warmth—until it changes or attention moves. The point is not durability; the point is to notice that experience shifts without your consent.",
    category: "insight",
    tags: ["seated", "10"],
    est_minutes: 10,
  },
  {
    title: "Tea or water ritual",
    summary:
      "Prepare a small drink in silence. For the first three sips, do nothing but taste. Name one texture or temperature, without a judgment essay.",
    category: "mindfulness",
    tags: ["short", "everyday", "5"],
    est_minutes: 5,
  },
  {
    title: "Wide-angle seeing",
    summary:
      "Soften the eyes as if you were looking at a horizon. Let the center of the visual field be less important than the whole field. A soft gaze can nudge a soft mind.",
    category: "insight",
    tags: ["calm", "5"],
    est_minutes: 5,
  },
  {
    title: "Evening unhooking",
    summary:
      "Name one thread from the day you are still carrying. Say once: that was then; the body is here. Let shoulders drop a fraction on the exhale.",
    category: "gratitude",
    tags: ["sleep", "5"],
    est_minutes: 5,
  },
  {
    title: "Forgiveness without drama",
    summary:
      "Bring to mind a small social bruise, not a trauma. Wish the other person ordinary ease—not because they were right, but to free your own day from replay.",
    category: "loving_kindness",
    tags: ["compassion", "10"],
    est_minutes: 10,
  },
  {
    title: "Breath at the belly",
    summary:
      "Hand on belly; feel the rise and fall. When the mind narrates, let the narration be a small sound in the same room as the movement under the hand.",
    category: "samatha",
    tags: ["breath", "beginner", "5"],
    est_minutes: 5,
  },
  {
    title: "Sitting in the questions",
    summary:
      "Hold one question: what would change if I didn’t have to be impressive today? No answer required; let the body answer in posture and breath for a few minutes.",
    category: "inquiry",
    tags: ["inquiry", "seated", "10"],
    est_minutes: 10,
  },
  {
    title: "Shamatha–open monitoring handoff",
    summary:
      "Five minutes: breath as anchor, gentle return when lost. Then five minutes: no anchor—rest as open knowing. Notice the quality shift without grading it.",
    category: "insight",
    tags: ["seated", "15"],
    est_minutes: 15,
  },
  {
    title: "Earth beneath you",
    summary:
      "Feel pressure through sit bones or feet into floor, then into the idea of support below. You do not have to create stability; you can let weight rest.",
    category: "zen",
    tags: ["anxiety", "5"],
    est_minutes: 5,
  },
  {
    title: "Gentle metta to the difficult one",
    summary:
      "Picture someone slightly irritating, not a danger. May they be free from harm’s edge; may my day not become their name tag. Breathe once between phrases.",
    category: "loving_kindness",
    tags: ["compassion", "10"],
    est_minutes: 10,
  },
  {
    title: "Morning one intention",
    summary:
      "Before the screen: one line—today I can return, once, without performance. When you forget, that was part of the line.",
    category: "gratitude",
    tags: ["short", "1"],
    est_minutes: 1,
  },
  {
    title: "Hearing your own name soften",
    summary:
      "Silently say your first name the way a friend would, not a critic. The difference in tone is data about how the inner voice is tuned.",
    category: "inquiry",
    tags: ["inquiry", "3"],
    est_minutes: 3,
  },
];
