// Laws of UX — the 30 principles collected by Jon Yablonski at lawsofux.com.
// One-line definitions summarised for daily reading; each links to its page
// on the site for the full explanation, origins and examples.

export const UX_LAWS_SOURCE = { name: 'Laws of UX', url: 'https://lawsofux.com/' };

export const UX_LAWS = [
  ['Aesthetic-Usability Effect', 'aesthetic-usability-effect', 'Users often perceive aesthetically pleasing design as design that’s more usable.'],
  ['Choice Overload', 'choice-overload', 'People tend to get overwhelmed when they are presented with a large number of options.'],
  ['Chunking', 'chunking', 'Break information into pieces and group them into meaningful wholes, so it’s easier to process and remember.'],
  ['Cognitive Bias', 'cognitive-bias', 'Systematic errors in thinking shape how we perceive the world and how we make decisions.'],
  ['Cognitive Load', 'cognitive-load', 'Every interface asks for mental resources to understand and use it — spend them wisely.'],
  [
    'Doherty Threshold',
    'doherty-threshold',
    'Productivity soars when a system and its user interact at a pace (under 400ms) where neither has to wait on the other.',
  ],
  ['Fitts’s Law', 'fittss-law', 'The time to acquire a target is a function of the distance to and size of the target.'],
  ['Flow', 'flow', 'The state of full immersion and energised focus in an activity — design to protect it, not interrupt it.'],
  ['Goal-Gradient Effect', 'goal-gradient-effect', 'The tendency to approach a goal increases with proximity to the goal.'],
  ['Hick’s Law', 'hicks-law', 'The time it takes to make a decision increases with the number and complexity of choices.'],
  ['Jakob’s Law', 'jakobs-law', 'Users spend most of their time on other products, so they expect yours to work the same way as the ones they already know.'],
  ['Law of Common Region', 'law-of-common-region', 'Elements tend to be perceived as a group when they share an area with a clearly defined boundary.'],
  ['Law of Proximity', 'law-of-proximity', 'Objects that are near, or proximate, to each other tend to be grouped together.'],
  ['Law of Prägnanz', 'law-of-pragnanz', 'People perceive ambiguous or complex images in the simplest form possible, because it takes the least effort.'],
  ['Law of Similarity', 'law-of-similarity', 'The eye tends to perceive similar elements as a complete picture, shape or group, even when they are separated.'],
  [
    'Law of Uniform Connectedness',
    'law-of-uniform-connectedness',
    'Elements that are visually connected are perceived as more related than elements with no connection.',
  ],
  ['Mental Model', 'mental-model', 'People carry a compressed model of how a system works — design to match it rather than fight it.'],
  ['Miller’s Law', 'millers-law', 'The average person can keep only about 7 (plus or minus 2) items in working memory.'],
  ['Occam’s Razor', 'occams-razor', 'Among competing solutions that work equally well, choose the one with the fewest assumptions.'],
  ['Paradox of the Active User', 'paradox-of-the-active-user', 'Users never read manuals; they start using the software immediately.'],
  ['Pareto Principle', 'pareto-principle', 'Roughly 80% of the effects come from 20% of the causes — find the vital few.'],
  ['Parkinson’s Law', 'parkinsons-law', 'Any task will inflate until all of the available time is spent.'],
  ['Peak-End Rule', 'peak-end-rule', 'People judge an experience largely by how they felt at its peak and at its end, not by the average of every moment.'],
  ['Postel’s Law', 'postels-law', 'Be liberal in what you accept, and conservative in what you send.'],
  ['Selective Attention', 'selective-attention', 'We focus our attention on only a subset of stimuli — usually those related to our goals.'],
  ['Serial Position Effect', 'serial-position-effect', 'Users best remember the first and last items in a series.'],
  ['Tesler’s Law', 'teslers-law', 'Every system has a certain amount of complexity that cannot be reduced — only moved. Take it on so users don’t have to.'],
  [
    'Von Restorff Effect',
    'von-restorff-effect',
    'When several similar objects are present, the one that differs from the rest is the most likely to be remembered.',
  ],
  ['Working Memory', 'working-memory', 'A small, temporary store holds the information needed to complete a task — don’t make people carry too much.'],
  ['Zeigarnik Effect', 'zeigarnik-effect', 'People remember uncompleted or interrupted tasks better than completed ones.'],
].map(([name, slug, summary]) => ({ name, summary, url: `${UX_LAWS_SOURCE.url}${slug}/` }));
