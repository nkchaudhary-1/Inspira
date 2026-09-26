// Daily inspiration library. Original lines, attributed to "Daily Inspiration"
// to avoid the misattributed-famous-quote problem common in quote apps.
// The daily pick is deterministic per date + category, so every tab that day
// shows the same line until the user asks for another.

import { hash } from '../core/ids.js';
import { UX_LAWS, UX_LAWS_SOURCE } from './uxLaws.js';

export const CATEGORIES = [
  { id: 'motivation', label: 'Motivation' },
  { id: 'focus', label: 'Focus' },
  { id: 'calm', label: 'Calm' },
  { id: 'creativity', label: 'Creativity' },
  { id: 'confidence', label: 'Confidence' },
  { id: 'uxlaws', label: 'Laws of UX' },
  { id: 'mixed', label: 'A bit of everything' },
];

export const QUOTES = {
  motivation: [
    'Small progress is still progress.',
    'Start before you feel ready. Ready is a feeling that follows action.',
    'The next step only has to be small enough to take.',
    'Momentum is built, not found.',
    'Today counts, even if it’s quiet.',
    'Done is a doorway. Perfect is a wall.',
    'You are allowed to begin again, as many times as it takes.',
    'A little every day beats a lot someday.',
    'The work you avoid is usually the work that matters.',
    'Show up. The rest gets easier once you’re in the room.',
    'Effort compounds quietly, then all at once.',
    'Make it exist first. Make it good after.',
    'One honest hour can change the shape of a day.',
    'Future you is built by what present you repeats.',
    'Progress likes a steady pace more than a sprint.',
    'You don’t need a new plan. You need the next move.',
    'Finish something today, even something small.',
    'Motivation fades. Habits carry you home.',
    'Hard things get lighter when you pick them up.',
    'The best time to move is while you’re still thinking about it.',
  ],
  focus: [
    'You don’t have to do everything today.',
    'One thing, fully. Then the next.',
    'Attention is the most honest thing you can give your work.',
    'Close the tabs in your head, too.',
    'Depth over busyness.',
    'Protect the first hour. It sets the tone for the rest.',
    'What matters most right now? Start there.',
    'Less switching, more finishing.',
    'Busy is easy. Focused is rare.',
    'Give this task the whole of you for a little while.',
    'Say no to the good so you can say yes to the essential.',
    'The notification can wait. This moment can’t.',
    'Clarity comes from doing, not from thinking about doing.',
    'A clear desk, a clear intention, a clear hour.',
    'Choose one thing that would make today feel complete.',
    'Single-tasking is a quiet superpower.',
    'When everything is urgent, nothing is. Pick one.',
    'Go deep on something small.',
    'The fewer things you hold, the tighter you can grip them.',
    'Stay with it a little longer than feels comfortable.',
  ],
  calm: [
    'Breathe first. Everything else second.',
    'There is enough time for what truly matters.',
    'Slow is smooth, and smooth is steady.',
    'You can rest without earning it.',
    'Let today be lighter than you expected.',
    'Not every thought needs an answer.',
    'Unclench your jaw. Drop your shoulders. Carry on.',
    'Peace isn’t the absence of noise. It’s where you stand within it.',
    'The storm passes. It always has.',
    'Be gentle with yourself — you’re doing more than you realise.',
    'Some days are for growing, some are for resting. Both count.',
    'Nothing is on fire. Take a breath.',
    'Let the next minute be the only one you manage.',
    'Softness is also a kind of strength.',
    'Calm is a skill, and every breath is practice.',
    'You are not behind. You are on your own timeline.',
    'Rest is part of the work.',
    'Notice one good thing around you right now.',
    'Quiet mornings make loud days easier.',
    'It’s okay to do less, and do it well.',
  ],
  creativity: [
    'Make something today that didn’t exist yesterday.',
    'Ideas arrive while you’re working, not while you’re waiting.',
    'The first draft’s only job is to exist.',
    'Curiosity is a better guide than certainty.',
    'Constraints are where the interesting ideas hide.',
    'Play is research in disguise.',
    'Steal the feeling, not the form.',
    'Ship the sketch. Refine the story.',
    'Every great thing started as an awkward version of itself.',
    'Look closer. The detail is usually the idea.',
    'Try the version that scares you a little.',
    'Taste is built by making a lot of things.',
    'Collect ideas like stones. Some will become walls.',
    'Your weird idea might be the one.',
    'Change the medium, and the idea changes too.',
    'Make it simple, then make it yours.',
    'Wonder is a daily practice.',
    'Leave room for accidents. They are often the best part.',
    'Good ideas need time. Great ones need revisits.',
    'Create first, critique later.',
  ],
  confidence: [
    'You have done hard things before. This is another one.',
    'Your voice belongs in the room.',
    'Trust the work you’ve already put in.',
    'Being unsure and being capable can happen at the same time.',
    'You don’t need permission to take up space.',
    'Mistakes are proof you’re trying.',
    'Speak like you mean it. You usually do.',
    'You are more ready than you feel.',
    'Courage is just a decision followed by a step.',
    'Your pace is valid. Your path is yours.',
    'Doubt is loud. Evidence is louder. Look at what you’ve done.',
    'You grow every time you choose the harder, better thing.',
    'Back yourself today.',
    'Nobody has it all figured out. Begin anyway.',
    'Confidence is built by keeping small promises to yourself.',
    'You’ve survived every hard day so far.',
    'Ask for what you need. It’s allowed.',
    'You are a work in progress, and that’s the point.',
    'Stand behind your ideas long enough to test them.',
    'Your best is enough, and it grows.',
  ],
};

const ATTRIBUTION = 'Daily Inspiration';

const lines = (cat) => QUOTES[cat].map((text) => ({ text, category: cat, author: ATTRIBUTION }));

/** A law reads as "name + definition", credited to Laws of UX with a link. */
const laws = () => UX_LAWS.map((law) => ({ text: law.summary, title: law.name, url: law.url, category: 'uxlaws', author: UX_LAWS_SOURCE.name }));

function poolFor(category) {
  if (category === 'uxlaws') return laws();
  if (category === 'mixed' || !QUOTES[category]) return [...Object.keys(QUOTES).flatMap(lines), ...laws()];
  return lines(category);
}

/** Deterministic pick for a day key + category, shifted by `n` for "another one". */
export function quoteFor(dayKey, category, n = 0) {
  const pool = poolFor(category);
  const idx = (hash(`${dayKey}:${category}`) + n) % pool.length;
  return { ...pool[idx] };
}
