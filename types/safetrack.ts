export type UserRole =
  | "guardian"
  | "child"
  | "admin";


/*
=====================================================
USERS
=====================================================
*/

export interface Guardian {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  avatarPath?: string | null;
  createdAt: string;
}


export interface Child {
  id: string;
  guardianId: string;
  fullName: string;
  age?: number | null;
  relationship?: string | null;

  trackingSource:
    | "smartwatch"
    | "mobile"
    | "both"
    | string;

  avatarUrl?: string | null;
  avatarPath?: string | null;
  createdAt: string;
}


export interface Administrator {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  createdAt: string;
}


/*
=====================================================
SMARTWATCH
=====================================================
*/

export interface SmartwatchDevice {
  id: string;
  childId: string;

  deviceName?: string | null;
  serialNumber?: string | null;
  watchId?: string | null;

  batteryLevel?: number | null;
  isOnline?: boolean;
  isActive?: boolean;

  pairedAt?: string | null;
  lastSeenAt?: string | null;
}


/*
=====================================================
LOCATION
=====================================================
*/

export interface LocationLog {
  id: string;

  childId: string;
  childName?: string | null;
  guardianId?: string | null;

  latitude: number;
  longitude: number;

  accuracyMeters?: number | null;

  locationLabel?: string | null;

  source:
    | "smartwatch"
    | "mobile"
    | "phone"
    | "manual"
    | string;

  recordedAt: string;
}


/*
=====================================================
GEOFENCE / AI
=====================================================
*/

export interface Geofence {
  id: string;

  guardianId?: string | null;
  childId: string;

  name: string;
  address?: string | null;

  latitude: number;
  longitude: number;

  centerLatitude: number;
  centerLongitude: number;

  radiusMeters: number;

  isEnabled: boolean;
  isActive?: boolean;

  createdAt?: string;
  updatedAt?: string;
}


export interface GeofenceEvent {
  id: string;

  childId: string;

  geofenceId?: string | null;
  locationLogId?: string | null;

  eventType:
    | "entry"
    | "exit"
    | "anomaly"
    | string;

  title: string;

  details?: string | null;

  anomalyScore?: number | null;

  latitude?: number | null;
  longitude?: number | null;

  occurredAt: string;
}


/*
=====================================================
SOS
=====================================================
*/

export type SosAlertStatus =
  | "active"
  | "acknowledged"
  | "resolved"
  | "canceled";


export type SosActivationMethod =
  | "smartwatch"
  | "mobile"
  | "shake"
  | "tap-and-hold"
  | "manual_button"
  | string;


export interface SosAlert {
  id: string;

  childId: string;

  childName?: string | null;
  guardianId?: string | null;

  status: SosAlertStatus;

  activationMethod: SosActivationMethod;

  locationLogId?: string | null;
  locationSource?: string | null;

  isTestAlert?: boolean;

  latitude?: number | null;
  longitude?: number | null;

  accuracyMeters?: number | null;

  triggeredAt: string;

  acknowledgedAt?: string | null;
  resolvedAt?: string | null;

  realertCount?: number;

  createdAt?: string | null;
}


/*
=====================================================
REPORTS
=====================================================
*/

export type ActivityReportType =
  | "daily_summary"
  | "location_history"
  | "sos_history"
  | "weekly_summary"
  | "activity"
  | "safety"
  | string;


export type ActivityReportStatus =
  | "generating"
  | "ready"
  | "failed"
  | "requested"
  | "completed"
  | string;


export type ActivityReportExportFormat =
  | "pdf"
  | "excel"
  | string;


export interface ActivityReport {
  id: string;

  childId: string;

  childName?: string | null;

  guardianId?: string | null;

  generatedByAdminId?: string | null;

  title: string;

  type: ActivityReportType;

  status: ActivityReportStatus;

  exportFormat: ActivityReportExportFormat;

  rangeStart: string;
  rangeEnd: string;

  generatedAt: string;

  generatedBy?: string | null;

  createdAt?: string | null;
}


/*
=====================================================
PUSH
=====================================================
*/

export interface GuardianPushToken {
  id: string;

  guardianId: string;

  expoPushToken: string;

  createdAt: string;
}


/*
=====================================================
ADMIN DASHBOARD
=====================================================
*/

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


/*
=====================================================
MENU MANAGEMENT
=====================================================
*/

export interface RoleSummary {
  id: string;

  roleCode: string;

  roleName: string;
}


export interface MenuItem {
  id: string;

  menuKey: string;

  menuName: string;

  name?: string;

  route: string;

  icon?: string | null;

  displayOrder?: number;
}


export interface MenuPermission {
  roleId: string;

  menuId: string;

  canView: boolean;
}


/*
=====================================================
CHILD MOBILE
=====================================================
*/

export type ChildSafeZoneState =
  | "inside"
  | "outside"
  | "no_safe_zone"
  | "unavailable";


export interface ChildMobileContext {
  childId: string;

  childName: string;

  guardianId?: string | null;

  guardianName?: string | null;

  guardianEmail?: string | null;

  trackingSource:
    | "mobile"
    | "smartwatch"
    | "both"
    | string;

  mobileDeviceActive: boolean;

  latestLocation?: LocationLog | null;

  deviceId?: string | null;

  deviceToken?: string | null;

  isLinked?: boolean;
}


export interface ChildSafeZoneStatus {
  status: ChildSafeZoneState;

  zoneName?: string | null;

  message: string;

  latestLocationAt?: string | null;

  inside?: boolean;
}


export interface ChildMobileSosAlert {
  id: string;

  childId: string;

  status: SosAlertStatus;

  activationMethod: string;

  triggeredAt: string;

  acknowledgedAt?: string | null;

  realertCount: number;

  latitude?: number | null;

  longitude?: number | null;

  locationSource?: string | null;

  createdAt?: string | null;
}


export interface ChildMobileLinkCode {
  childId: string;

  linkCode: string;

  expiresAt: string;
}