import { HashRouter, Routes, Route } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { AuthGate } from './components/AuthGate';
import { Home } from './screens/Home';
import { Trips } from './screens/Trips';
import { Wallet } from './screens/Wallet';
import { Profile } from './screens/Profile';
import { TripDetail } from './screens/TripDetail';
import { Action } from './screens/Action';
import { Capture } from './screens/Capture';
import { LogHotel } from './screens/LogHotel';
import { LogFlight } from './screens/LogFlight';

export default function App() {
  return (
    <HashRouter>
     <AuthGate>
      <div className="screen on">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/trips/:id" element={<TripDetail />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/log-hotel" element={<LogHotel />} />
          <Route path="/log-flight" element={<LogFlight />} />
          <Route path="/action/:kind" element={<Action />} />
        </Routes>
      </div>
      <TabBar />
     </AuthGate>
    </HashRouter>
  );
}
