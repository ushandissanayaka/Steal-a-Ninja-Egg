import { useEffect, useRef } from 'react';
import { Game } from './game/Game.js';
import { bloxity } from './bloxity/bloxity.js';
import Hud from './ui/Hud.jsx';
import MobileControls from './ui/MobileControls.jsx';
import LoadingScreen from './ui/LoadingScreen.jsx';
import { uiStore } from './ui/store.js';
import { reloadGame, retryDelayMs } from './net/connection.js';

export default function App() {
  const container = useRef(null);
  const game = useRef(null);

  useEffect(() => {
    const instance = new Game(container.current, uiStore);
    game.current = instance;
    instance.start().catch((err) => {
      console.error(err);
      bloxity.loadingEnd();
      // never a dead end: the loading page says so and tries again by itself (waiting longer each time)
      const wait = retryDelayMs();
      uiStore.set({ phase: 'failed', error: err?.message || String(err), retryAt: Date.now() + wait });
      setTimeout(() => reloadGame(), wait);
    });
    return () => instance.dispose();
  }, []);

  return (
    <div className="app">
      <div className="viewport" ref={container} />
      <Hud
        onDrop={() => game.current?.interaction?.dropEggs()}
        onSwing={() => game.current?.toggleTornado()}
        onAction={(type, payload) => (type === 'exitArena' ? game.current?.player?.exitArena() : game.current?.room?.send(type, payload))}
        onMute={(muted) => bloxity.setMuted(muted)}
      />
      <MobileControls game={game} />
      <LoadingScreen />
    </div>
  );
}
