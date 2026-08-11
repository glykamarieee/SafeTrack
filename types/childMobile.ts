export type ChildMobileTrackingSource =
  | "smartwatch"
  | "mobile"
  | "both"
  | string;

export type ChildSafeZoneState =
  | "inside"
  | "outside"
  | "no_safe_zone"
  | "unavailable";

export interface ChildMobileLocation {
  id: string;
  childId: string;
  childName?: string | null;
  guardianId?: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  source: string;
  locationLabel?: string | null;
  recordedAt: string;
}

export interface ChildMobileContext {
  childId: string;
  childName: string;
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  trackingSource: ChildMobileTrackingSource;
  mobileDeviceActive: boolean;
  mobilePlatform?: string | null;
  linkedAt?: string | null;
  latestLocation: ChildMobileLocation | null;
}

export interface ChildSafeZoneStatus {
  status: ChildSafeZoneState;
  zoneName?: string | null;
  message: string;
  latestLocationAt?: string | null;
}

export interface ChildMobileLinkCode {
  childId: string;
  linkCode: string;
  expiresAt: string;
}

export interface ChildMobileSosAlert {
  id: string;
  status: "active" | "acknowledged" | string;
  activationMethod?: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  realertCount: number;
  latitude?: number | null;
  longitude?: number | null;
}