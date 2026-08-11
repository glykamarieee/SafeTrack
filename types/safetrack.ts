export type UserRole = "guardian" | "child" | "admin";

export interface Guardian {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  avatarPath?: string;
  createdAt: string;
}

export interface Child {
  id: string;
  guardianId: string;
  fullName: string;
  age?: number;
  relationship?: string;
  trackingSource?: "smartwatch" | "mobile" | "both" | string;
  avatarUrl?: string;
  avatarPath?: string;
  createdAt: string;
}

export interface Administrator {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export interface SmartwatchDevice {
  id: string;
  childId: string;
  deviceName: string;
  serialNumber: string;
  batteryLevel?: number;
  isOnline: boolean;
  lastSeenAt?: string;
  watchId?: string;
  isActive?: boolean;
  pairedAt?: string;
}

export interface LocationLog {
  id: string;
  childId: string;
  childName: string;
  guardianId?: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  source: "smartwatch" | "phone" | "mobile" | "manual" | string;
  locationLabel?: string;
  recordedAt: string;
}

export interface Geofence {
  id: string;
  guardianId: string;
  childId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  isEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceEvent {
  id: string;
  childId?: string;
  geofenceId?: string;
  locationLogId?: string;
  eventType: "enter" | "exit" | string;
  title: string;
  details?: string;
  anomalyScore?: number;
  latitude?: number;
  longitude?: number;
  occurredAt: string;
}

export type SosAlertStatus = "active" | "acknowledged" | "resolved";

export type SosActivationMethod =
  | "manual_button"
  | "smartwatch"
  | "app_test"
  | "voice"
  | string;

export interface SosAlert {
  id: string;
  childId: string;
  childName: string;
  guardianId: string;
  status: SosAlertStatus;
  activationMethod: SosActivationMethod;
  isTestAlert: boolean;
  locationLogId?: string;
  locationSource?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  realertCount?: number;
}

export type ActivityReportType =
  | "daily_summary"
  | "location_history"
  | "sos_history"
  | "weekly_summary"
  | string;

export type ActivityReportStatus =
  | "generating"
  | "ready"
  | "failed"
  | "requested"
  | string;

export type ActivityReportExportFormat = "pdf" | "excel" | string;

export interface ActivityReport {
  id: string;
  childId: string;
  childName: string;
  guardianId?: string;
  generatedByAdminId?: string;
  title: string;
  type: ActivityReportType;
  status: ActivityReportStatus;
  exportFormat: ActivityReportExportFormat;
  rangeStart: string;
  rangeEnd: string;
  generatedAt: string;
}

export interface GuardianPushToken {
  id: string;
  guardianId: string;
  expoPushToken: string;
  createdAt: string;
}

export interface SystemAdministrator {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export interface AdminSummaryMetrics {
  guardianAccounts: number;
  administratorAccounts: number;
  registeredChildren: number;
  activeDevices: number;
  activeSafeZones: number;
  locationRecords: number;
  activeSosAlerts: number;
  generatedReports: number;
}

export interface RoleSummary {
  id: string;
  roleCode: string;
  roleName: string;
}

export interface MenuItem {
  id: string;
  menuKey: string;
  menuName: string;
  routePath: string;
  iconName?: string;
  displayOrder: number;
}

export interface MenuPermission {
  roleId: string;
  menuId: string;
  canView: boolean;
}
export type ChildSafeZoneState =
  | "inside"
  | "outside"
  | "no_safe_zone"
  | "unavailable";

export interface ChildMobileContext {
  childId: string;
  childName: string;
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  trackingSource: "smartwatch" | "mobile" | "both" | string;
  mobileDeviceActive: boolean;
  mobilePlatform?: string | null;
  linkedAt?: string | null;
  latestLocation: LocationLog | null;
}

export interface ChildSafeZoneStatus {
  status: ChildSafeZoneState;
  zoneName?: string | null;
  message: string;
  latestLocationAt?: string | null;
}

export interface ChildMobileSosAlert {
  id: string;
  status: SosAlertStatus;
  activationMethod: SosActivationMethod;
  triggeredAt: string;
  acknowledgedAt?: string | null;
  realertCount: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ChildMobileLinkCode {
  childId: string;
  linkCode: string;
  expiresAt: string;
}