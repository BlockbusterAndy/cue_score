import { go, useRoute } from './hooks/device';
import { useStore } from './store/AppStore';
import { Home } from './screens/Home';
import { NewMatch } from './screens/NewMatch';
import { Rules } from './screens/Rules';
import { Scoreboard } from './screens/Scoreboard';
import { Stats } from './screens/Stats';
import { Summary } from './screens/Summary';
import { Btn } from './ui/kit';

export function App() {
  const [screen, id] = useRoute();
  const { ready, matches } = useStore();

  if (!ready) return <div className="min-h-dvh" aria-busy="true" />;

  switch (screen) {
    case 'new':
      return <NewMatch />;
    case 'match': {
      const rec = matches.find((m) => m.id === id);
      if (!rec) return <NotFound />;
      // key: a different match gets a fresh reducer.
      return <Scoreboard key={rec.id} record={rec} />;
    }
    case 'summary': {
      const rec = matches.find((m) => m.id === id);
      return rec ? <Summary record={rec} /> : <NotFound />;
    }
    case 'stats':
      return <Stats />;
    case 'rules':
      return <Rules focus={id} />;
    default:
      return <Home />;
  }
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg">That match isn’t on this phone.</p>
      <Btn variant="gold" onClick={() => go('', true)}>
        Home
      </Btn>
    </main>
  );
}
