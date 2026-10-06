import { useNavigate } from 'react-router-dom';
import { TripsIcon, WalletIcon } from './Icons';
import { MODE_HOME, useAppMode, writeMode, type AppMode } from '../lib/appMode';

// Two icons, Travel and Loyalty: tap the other one to switch halves of
// the app (and its theme). Sits beside the settings gear.
export function SectionSwitch() {
  const navigate = useNavigate();
  const mode = useAppMode();
  return (
    <div className="modeswitch" role="radiogroup" aria-label="Section">
      {(['travel', 'loyalty'] as AppMode[]).map((m) => (
        <button
          key={m} role="radio" aria-checked={mode === m} aria-label={m === 'travel' ? 'Travel' : 'Loyalty'}
          className={mode === m ? 'on' : ''}
          onClick={() => { if (m !== mode) { writeMode(m); navigate(MODE_HOME[m]); } }}
        >
          {m === 'travel' ? <TripsIcon size={18} /> : <WalletIcon size={18} />}
        </button>
      ))}
    </div>
  );
}
