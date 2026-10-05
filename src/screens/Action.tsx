import { useParams, useNavigate } from 'react-router-dom';
import { MailIcon, PlusCircleIcon, BedIcon, PlaneIcon, WalletIcon, TagIcon } from '../components/Icons';
import { OptionRow, ScreenHeader } from '../components/ui';

const CONTENT: Record<string, { title: string; actions?: { label: string; to: string; Icon: typeof MailIcon }[] }> = {
  capture: {
    title: 'Add',
    actions: [
      { label: 'Log a stay', to: '/add/stay', Icon: BedIcon },
      { label: 'Log a flight', to: '/add/flight', Icon: PlaneIcon },
      { label: 'Start a new trip', to: '/log-trip', Icon: PlusCircleIcon },
      { label: 'Import an email', to: '/scan-email', Icon: MailIcon },
      { label: 'Add a card', to: '/add-card', Icon: WalletIcon },
      { label: 'Add a loyalty programme', to: '/log-loyalty-programme', Icon: TagIcon },
    ],
  },
};

export function Action() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const c = CONTENT[kind ?? ''] ?? { title: kind ?? '' };

  return (
    <div>
      <ScreenHeader title={c.title} />
      {c.actions && (
        <div style={{ padding: '10px 20px', display: 'grid', gap: 10 }}>
          {c.actions.map((a) => (
            <OptionRow key={a.to} icon={<a.Icon size={19} color="var(--brand)" />} label={a.label} onClick={() => navigate(a.to)} />
          ))}
        </div>
      )}
    </div>
  );
}
