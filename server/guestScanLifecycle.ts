export type GuestScanStatus = { guestScanCompleted: boolean; canStartGuestScan: boolean };

export function getGuestScanStatus(usedAt: Date | null | undefined): GuestScanStatus {
  const guestScanCompleted = Boolean(usedAt);
  return { guestScanCompleted, canStartGuestScan: !guestScanCompleted };
}

export function canConsumeGuestScanAfterCompletion(scanSucceeded: boolean, usedAt: Date | null | undefined) {
  return scanSucceeded && !usedAt;
}
