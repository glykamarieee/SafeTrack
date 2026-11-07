/**
 * Field-test log (2026-11-08): one short line per event, read back over adb
 * after an outdoor test:
 *
 *   adb logcat -G 16M            (before going out: a bigger log buffer)
 *   adb logcat -d | findstr STLOG
 *
 * Lines go to the phone's system log only (never to the server or the
 * screen). Set TEST_LOG to false to turn it off for the defense.
 */
export const TEST_LOG = true;

export function testLog(event: string, data: Record<string, unknown>) {
  if (!TEST_LOG) return;
  const fields = Object.entries(data)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}=${typeof value === "number" ? Math.round(value * 100) / 100 : value}`)
    .join(" ");
  console.log(`[STLOG] ${new Date().toISOString()} ${event} ${fields}`);
}
