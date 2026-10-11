// Award (redemption) booking classes by operating airline: the single
// letter a points ticket is booked into, and the cabin it means. A
// booking class only means anything for its own airline -- "U" is a
// Qatar Airways or British Airways business award, but on LOT it is a
// cash Saver economy fare (the user's LOT ticket, BUD-WAW-LHR, 26 Oct
// 2026, shows "Class: SAVER, U"). Only airlines with a sourced list are
// here; anything else is read as a cash fare.
//
// Sources, checked 11 Oct 2026:
//  - Qatar Airways: U business (Qsuite included), X economy -- AwardLocker,
//    "Airline fare classes explained" (awardlocker.com/fare-classes); and the
//    user's own Qatar award booking 8GAQIL (80,000 Avios, BUSINESS (U)).
//  - British Airways: X economy, P premium economy, U business, Z first
//    reward inventory -- The Points Guy UK, "BA fare classes explained";
//    BA's cash classes (ExpertFlyer: business C D I J R, premium E T W,
//    economy B G H K L M N O Q S Y) don't include U, X, P or Z.
export type AwardCabin = 'Economy' | 'Premium Economy' | 'Business' | 'First';

export const AWARD_CLASSES: Record<string, Record<string, AwardCabin>> = {
  QR: { U: 'Business', X: 'Economy' },
  BA: { X: 'Economy', P: 'Premium Economy', U: 'Business', Z: 'First' },
};
