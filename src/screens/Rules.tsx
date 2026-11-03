import { useEffect } from 'react';
import type { ModeId } from '../engine';
import { go } from '../hooks/device';
import { MODES } from '../modes';
import { Card, TopBar } from '../ui/kit';

const TEXT: Record<ModeId, string[]> = {
  points: [
    'This is the house game. There is one red, worth 10. The colours are yellow 2, green 3, brown 4, blue 5, pink 6 and black 7.',
    'Pot any ball, in any order. Keep potting and you keep playing. Miss and it’s the next player’s turn.',
    'Foul? You lose the value of the ball you fouled on. Your score can go below zero.',
    'Rack: potted balls go grey. If one comes back on the table, tap it again. “New rack” puts all the balls back and keeps the scores.',
    'No rack: every ball you pot goes straight back on its spot, so all the balls are always in play. Pick this when you set up the match.',
    'It’s one game, not frames. End it when you’re done, or set a target score and the first to reach it wins.',
    'All the values and the foul rule can be changed when you set up the match.',
  ],
  snooker: [
    'There are 15 reds (1 point each) and six colours: yellow 2, green 3, brown 4, blue 5, pink 6, black 7.',
    'Pot a red, then any colour, then a red, and so on. Colours come back onto the table while there are reds left.',
    'When the reds are gone, pot the colours in order: yellow, green, brown, blue, pink, black.',
    'A foul gives your opponent at least 4 points, or 5, 6 or 7 if the blue, pink or black was involved.',
    'After a foul, if you can’t hit the ball on, you may get a free ball: pick any colour and it counts as the ball on.',
    'If the scores are level after the last black, the black goes back on its spot. Whoever scores next wins.',
    'The highest possible break is 147: 15 reds with 15 blacks, then all the colours.',
  ],
  short: [
    'Exactly like snooker, with fewer reds so a frame is quicker.',
    'With 10 reds the most you can score in one go is 107. With 6 reds it’s 75.',
  ],
  killer: [
    'Everyone starts with the same number of lives (usually 3).',
    'On your turn you must pot a ball. Pot one and you keep your life and play again.',
    'Miss, or foul, and you lose a life. Lose them all and you’re out.',
    'The last player with a life left wins. Works for 3 to 10 players.',
  ],
  free: [
    'Make up your own game. Choose the balls and what each one is worth.',
    'Nothing is enforced: tap a ball when it goes in, tap Foul when someone fouls, End turn to pass.',
  ],
};

const GENERAL = [
  'Tap a ball when it goes in. Tap End turn after a miss or a safety shot.',
  'Tap any player’s name to put them at the table.',
  'Undo works for the whole match, as many times as you need.',
  'The screen stays awake during a match, and the score is saved after every shot.',
];

export function Rules({ focus }: { focus?: string }) {
  useEffect(() => {
    if (focus) document.getElementById(`rules-${focus}`)?.scrollIntoView({ block: 'start' });
  }, [focus]);
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Rules" subtitle="Plain-language guide" onBack={() => history.length > 1 ? history.back() : go('')} />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-3 px-3 py-3">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Using the scoreboard</h2>
          <ul className="list-disc space-y-1 pl-5 text-cream/85">
            {GENERAL.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
        {MODES.map((m) => (
          <Card key={m.id} className={focus === m.id ? '!ring-2 !ring-gold' : ''}>
            <section id={`rules-${m.id}`} className="scroll-mt-20">
              <h2 className="mb-2 text-lg font-semibold">{m.name}</h2>
              <ul className="list-disc space-y-1 pl-5 text-cream/85">
                {TEXT[m.id].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          </Card>
        ))}
      </main>
    </div>
  );
}
