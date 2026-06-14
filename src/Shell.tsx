import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './screens/Home';
import Translate from './screens/Translate';
import Play from './screens/Play';
import Deck from './screens/Deck';
import Join from './screens/Join';
import Settings from './screens/Settings';

const Shell: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/translate" element={<Translate />} />
        <Route path="/play" element={<Play />} />
        <Route path="/deck" element={<Deck />} />
        <Route path="/join" element={<Join />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <nav>
        <a href="#/">Today</a>
        <a href="#/translate">Translate</a>
        <a href="#/play">Play</a>
        <a href="#/deck">Deck</a>
        <a href="#/settings">Settings</a>
      </nav>
    </HashRouter>
  );
};

export default Shell;
