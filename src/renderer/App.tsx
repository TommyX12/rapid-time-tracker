import { MemoryRouter as Router, Route, Routes } from 'react-router-dom';
import { Main } from './components/Main';

import './App.css';

import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/popover2/lib/css/blueprint-popover2.css';
import '@blueprintjs/datetime/lib/css/blueprint-datetime.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';
import '@blueprintjs/datetime2/lib/css/blueprint-datetime2.css';
// eslint-disable-next-line import/order
import { enableMapSet } from 'immer';

enableMapSet();

export default function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Main />} />
        </Routes>
      </Router>
    </>
  );
}
