import { PromotionsTab } from '../components/PromotionsTab';
import { ScreenHeader } from '../components/ui';

// Every promotion in one list, including ones not tied to a programme;
// each programme's own are on its page under Status too.
export function Promotions() {
  return (
    <div>
      <ScreenHeader title="Promotions" />
      <div className="page-body"><PromotionsTab /></div>
    </div>
  );
}
