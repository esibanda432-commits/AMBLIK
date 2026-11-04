import { useCallback, useState } from 'react';
import Banner from './components/Banner';
import Assistant from './components/Assistant';
import Dial from './components/Dial';
import Sheet from './components/Sheet';
import type { PanelId } from './data/content';

export default function App() {
  const [panel, setPanel] = useState<PanelId | null>(null);
  const close = useCallback(() => setPanel(null), []);

  return (
    <main className="page">
      <Banner onOpen={setPanel} />
      <Assistant onOpen={setPanel} />
      <Dial onOpen={setPanel} />
      <Sheet id={panel} onClose={close} />
    </main>
  );
}
