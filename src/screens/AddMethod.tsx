import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarIcon, MailIcon, EditIcon } from '../components/Icons';
import { OptionRow, ScreenHeader } from '../components/ui';
import { useTrips } from '../lib/useLiveData';

// First step of logging a stay or flight: how to add it. The next screen is
// already tied to the trip when this was opened from one.
export function AddMethod() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const tripId = (useLocation().state as { tripId?: string } | null)?.tripId;
  const { data: trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const noun = kind === 'flight' ? 'flight' : 'stay';
  const state = { tripId };

  return (
    <div>
      <ScreenHeader title={trip ? `Log a ${noun} for ${trip.title}` : `Log a ${noun}`} />
      <div className="h-sub" style={{ padding: '0 20px 6px' }}>How would you like to add it?</div>
      <div style={{ padding: '10px 20px', display: 'grid', gap: 10 }}>
        <OptionRow icon={<MailIcon size={19} color="var(--brand)" />} label="Import an email" onClick={() => navigate('/scan-email', { state })} />
        <OptionRow icon={<CalendarIcon size={19} color="var(--brand)" />} label="Import from calendar" onClick={() => navigate('/import-calendar', { state })} />
        <OptionRow icon={<EditIcon size={19} color="var(--brand)" />} label="Enter manually" onClick={() => navigate(noun === 'flight' ? '/log-flight' : '/log-hotel', { state })} />
      </div>
    </div>
  );
}
