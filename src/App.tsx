import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { Today } from './screens/Today';
import { Trips } from './screens/Trips';
import { Places } from './screens/Places';
import { Status } from './screens/Status';
import { Programme } from './screens/Programme';
import { Cards } from './screens/Cards';
import { Promotions } from './screens/Promotions';
import { Settings } from './screens/Settings';
import { TripDetail } from './screens/TripDetail';
import { LogLoyaltyProgramme } from './screens/LogLoyaltyProgramme';
import { LogHotel } from './screens/LogHotel';
import { LogFlight } from './screens/LogFlight';
import { LogTrip } from './screens/LogTrip';
import { ScanEmail } from './screens/ScanEmail';
import { ScanPromotion } from './screens/ScanPromotion';
import { BankSync } from './screens/BankSync';
import { AddCard } from './screens/AddCard';
import { ImportCalendar } from './screens/ImportCalendar';
import { ReviewTrip } from './screens/ReviewTrip';
import { StayReview } from './screens/StayReview';

// Plan carries the hotel price database, so it loads when it's opened.
const Plan = lazy(() => import('./screens/Plan').then((m) => ({ default: m.Plan })));
import { CreditAdvisor } from './screens/CreditAdvisor';

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
     <StatusBarCover />
     <AuthGate>
      <div className="screen on">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/trips/:id" element={<TripDetail />} />
            <Route path="/map" element={<Places />} />
            <Route path="/plan" element={<Suspense fallback={null}><Plan /></Suspense>} />
            <Route path="/status" element={<Status />} />
            <Route path="/status/:name" element={<Programme />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/add-card" element={<AddCard />} />
            <Route path="/import-calendar" element={<ImportCalendar />} />
            <Route path="/log-hotel" element={<LogHotel />} />
            <Route path="/log-flight" element={<LogFlight />} />
            <Route path="/log-trip" element={<LogTrip />} />
            <Route path="/scan-email" element={<ScanEmail />} />
            <Route path="/scan-promotion" element={<ScanPromotion />} />
            <Route path="/bank-sync" element={<BankSync />} />
            <Route path="/review-trip" element={<ReviewTrip />} />
            <Route path="/review/:name" element={<StayReview />} />
            <Route path="/log-loyalty-programme" element={<LogLoyaltyProgramme />} />
            <Route path="/credit" element={<CreditAdvisor />} />
            {/* Old addresses from the two-section app, kept so saved links and
                the home-screen shortcut still land somewhere sensible. */}
            <Route path="/now" element={<Navigate to="/" replace />} />
            <Route path="/then" element={<Navigate to="/trips" replace />} />
            <Route path="/profile" element={<Navigate to="/trips" replace />} />
            <Route path="/loyalty" element={<Navigate to="/status" replace />} />
            <Route path="/wallet" element={<Navigate to="/cards" replace />} />
            <Route path="/action/plan" element={<Navigate to="/plan" replace />} />
            <Route path="/add/stay" element={<Navigate to="/log-hotel" replace />} />
            <Route path="/add/flight" element={<Navigate to="/log-flight" replace />} />
            <Route path="/action/credit" element={<Navigate to="/credit" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
      <TabBar />
     </AuthGate>
    </HashRouter>
  );
}
