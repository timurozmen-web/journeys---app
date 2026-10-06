import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { modeForPath, readMode, useAppMode, writeMode } from './lib/appMode';
import { Start } from './screens/Start';
import { TabBar } from './components/TabBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { LoyaltyHome } from './screens/LoyaltyHome';
import { Trips } from './screens/Trips';
import { Wallet } from './screens/Wallet';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { TripDetail } from './screens/TripDetail';
import { Action } from './screens/Action';
import { Discover } from './screens/Discover';
import { Plan } from './screens/Plan';
import { LogLoyaltyProgramme } from './screens/LogLoyaltyProgramme';
import { LogHotel } from './screens/LogHotel';
import { LogFlight } from './screens/LogFlight';
import { LogTrip } from './screens/LogTrip';
import { ScanEmail } from './screens/ScanEmail';
import { ScanPromotion } from './screens/ScanPromotion';
import { BankSync } from './screens/BankSync';
import { AddMethod } from './screens/AddMethod';
import { AddCard } from './screens/AddCard';
import { ImportCalendar } from './screens/ImportCalendar';
import { ReviewTrip } from './screens/ReviewTrip';
import { CreditAdvisor } from './screens/CreditAdvisor';

// Keeps the section (and its theme) in step with the screen being shown.
function ModeSync() {
  const { pathname } = useLocation();
  const mode = useAppMode();
  useEffect(() => { writeMode(modeForPath(pathname, readMode())); }, [pathname]);
  useEffect(() => { document.documentElement.dataset.mode = mode; }, [mode]);
  return null;
}

// The status bar is translucent (so photos can run to the top edge), which
// let page text scroll up underneath the clock and look as if it faded
// away. Once the page has scrolled, a strip in the page colour covers the
// status bar area.
function StatusBarCover() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div className={scrolled ? 'statuscover on' : 'statuscover'} aria-hidden="true" />;
}

export default function App() {
  return (
    <HashRouter>
     <ModeSync />
     <StatusBarCover />
     <AuthGate>
      <div className="screen on">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Start />} />
            <Route path="/now" element={<Trips />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/then" element={<Profile />} />
            <Route path="/loyalty" element={<LoyaltyHome />} />
            <Route path="/trips/:id" element={<TripDetail />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/add/:kind" element={<AddMethod />} />
            <Route path="/add-card" element={<AddCard />} />
            <Route path="/import-calendar" element={<ImportCalendar />} />
            <Route path="/log-hotel" element={<LogHotel />} />
            <Route path="/log-flight" element={<LogFlight />} />
            <Route path="/log-trip" element={<LogTrip />} />
            <Route path="/scan-email" element={<ScanEmail />} />
            <Route path="/scan-promotion" element={<ScanPromotion />} />
            <Route path="/bank-sync" element={<BankSync />} />
            <Route path="/review-trip" element={<ReviewTrip />} />
            <Route path="/action/:kind" element={<Action />} />
            <Route path="/action/discover" element={<Discover />} />
            <Route path="/action/plan" element={<Plan />} />
            <Route path="/log-loyalty-programme" element={<LogLoyaltyProgramme />} />
            <Route path="/action/credit" element={<CreditAdvisor />} />
          </Routes>
        </ErrorBoundary>
      </div>
      <TabBar />
     </AuthGate>
    </HashRouter>
  );
}
