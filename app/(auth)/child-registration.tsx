import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { SafeTrackBackButton } from "../../components/common/SafeTrackBackButton";
import { useAuthStore } from "../../store/authStore";
import {
  completeChildRegistration,
  type TrackingSource,
} from "../../services/childOnboardingService";
import { generateWatchConnectionCode } from "../../services/watchPairingService";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

const relationships = [
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Sibling",
  "Other",
];

// SafeTrack FINAL: smartwatch is mandatory primary child-side device.
// The child mobile device is optional only as an additional location source.
const sources: Array<{
  value: TrackingSource;
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    value: "smartwatch",
    title: "Smartwatch",
    detail: "Use the child’s required Wear OS smartwatch as the primary device.",
    icon: "watch-outline",
  },
  {
    value: "both",
    title: "Smartwatch + Mobile",
    detail: "Use the smartwatch as primary and a child mobile device as an additional location source.",
    icon: "git-compare-outline",
  },
];

type ConnectionCodeResult = {
  connectionCode: string;
  expiresAt: string;
  watchId: string;
  childId: string;
  childName: string;
};

function formatExpiry(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "10 minutes";

  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChildRegistrationScreen() {
  const router = useRouter();
  const guardian = useAuthStore((state) => state.guardian);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [relationship, setRelationship] = useState("Guardian");
  const [trackingSource, setTrackingSource] =
    useState<TrackingSource>("smartwatch");
  const [watchId, setWatchId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationCompleted, setRegistrationCompleted] = useState(false);
  const [connection, setConnection] = useState<ConnectionCodeResult | null>(null);

  const normalizedWatchId = watchId.trim().toUpperCase();

  const createConnectionCode = async () => {
    if (!normalizedWatchId) {
      setError("Enter the registered smartwatch connection ID.");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await generateWatchConnectionCode({ watchId: normalizedWatchId });
      setConnection(result);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to generate the smartwatch connection code.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveChild = async () => {
    setError(null);

    // If the child/watch link was already saved but code generation failed,
    // retry only the connection-code step instead of creating a duplicate child.
    if (registrationCompleted) {
      await createConnectionCode();
      return;
    }

    const numericAge = Number(age);

    if (fullName.trim().length < 2) {
      setError("Enter the child’s full name.");
      return;
    }

    if (
      !Number.isInteger(numericAge) ||
      numericAge < 6 ||
      numericAge > 15
    ) {
      setError("SafeTrack is scoped for children aged 6 to 15 years old.");
      return;
    }

    if (!normalizedWatchId) {
      setError("Enter the registered smartwatch connection ID.");
      return;
    }

    setSaving(true);

    try {
      const result = await completeChildRegistration({
        fullName: fullName.trim(),
        age: numericAge,
        relationship,
        trackingSource,
        watchId: normalizedWatchId,
      });

      setRegistrationCompleted(true);
      setConnection({
        connectionCode: result.connectionCode,
        expiresAt: result.expiresAt,
        watchId: result.device.watch_id,
        childId: result.child.id,
        childName: result.child.full_name,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to complete child registration.",
      );
    } finally {
      setSaving(false);
    }
  };

  const continueToDashboard = async () => {
    setSaving(true);
    setError(null);

    try {
      await bootstrap();
      router.replace("/(app)/home");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to open the Guardian dashboard.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (connection) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.codeContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark-circle-outline"
              size={46}
              color={colors.primary}
            />
          </View>

          <Text style={styles.codeEyebrow}>SMARTWATCH LINKED</Text>
          <Text style={styles.codeTitle}>Connect the child’s watch</Text>
          <Text style={styles.codeSubtitle}>
            Enter this 6-digit code on the SafeTrack app installed on the child’s Galaxy Watch.
          </Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>CHILD DEVICE CONNECTION CODE</Text>
            <Text style={styles.codeValue}>{connection.connectionCode}</Text>

            <View style={styles.expiryRow}>
              <Ionicons name="time-outline" size={16} color={colors.muted} />
              <Text style={styles.expiryText}>
                Valid until {formatExpiry(connection.expiresAt)}
              </Text>
            </View>
          </View>

          <View style={styles.linkedInfoCard}>
            <View style={styles.linkedRow}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
              <View style={styles.linkedCopy}>
                <Text style={styles.linkedLabel}>CHILD</Text>
                <Text style={styles.linkedValue}>{connection.childName}</Text>
              </View>
            </View>

            <View style={styles.linkedDivider} />

            <View style={styles.linkedRow}>
              <Ionicons name="watch-outline" size={18} color={colors.primary} />
              <View style={styles.linkedCopy}>
                <Text style={styles.linkedLabel}>WATCH ID</Text>
                <Text style={styles.linkedValue}>{connection.watchId}</Text>
              </View>
            </View>
          </View>

          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>On the Galaxy Watch8</Text>
            <Text style={styles.instructionText}>
              1. Open SafeTrack.{"\n"}
              2. Enter the 6-digit code above.{"\n"}
              3. Tap CONNECT.{"\n"}
              4. After verification, the Child Dashboard opens automatically.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={21}
                color={colors.danger}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => void continueToDashboard()}
            disabled={saving}
            style={({ pressed }) => [
              styles.button,
              (pressed || saving) && styles.pressed,
              saving && styles.disabled,
            ]}
          >
            <Ionicons
              name="home-outline"
              size={20}
              color={colors.white}
            />
            <Text style={styles.buttonText}>
              {saving ? "Opening dashboard..." : "Continue to Dashboard"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void createConnectionCode()}
            disabled={saving}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
              saving && styles.disabled,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={colors.primaryDark}
            />
            <Text style={styles.secondaryButtonText}>Generate a new code</Text>
          </Pressable>

          <Text style={styles.codeFootnote}>
            Generating a new code invalidates the previous connection code. The code is required only for first-time device verification or when the watch must be paired again.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SafeTrackBackButton fallbackHref="/(auth)/login" />

          <View style={styles.stepArea}>
            <Text style={styles.stepText}>STEP 2 OF 2</Text>
            <View style={styles.stepRail}>
              <View style={styles.stepProgress} />
            </View>
          </View>

          <Text style={styles.eyebrow}>CHILD SAFETY SETUP</Text>
          <Text style={styles.title}>Register your child</Text>
          <Text style={styles.subtitle}>
            Add the child information and link the required SafeTrack smartwatch.
          </Text>

          <View style={styles.registeringCard}>
            <View style={styles.registerIcon}>
              <Ionicons
                name="people-outline"
                size={19}
                color={colors.primary}
              />
            </View>
            <View style={styles.registerCopy}>
              <Text style={styles.registerLabel}>REGISTERING AS</Text>
              <Text style={styles.registerName}>
                {guardian?.fullName || "Guardian"}
              </Text>
            </View>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.primary}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Child details</Text>
                <Text style={styles.cardSubtitle}>
                  Use the child’s correct information.
                </Text>
              </View>
              <View style={styles.requiredPill}>
                <Text style={styles.requiredText}>Required</Text>
              </View>
            </View>

            <Text style={styles.label}>Child&apos;s full name</Text>
            <View style={styles.inputShell}>
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.primary}
              />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                style={styles.input}
                placeholder="Enter child’s full name"
                placeholderTextColor="#98A49F"
                autoCapitalize="words"
              />
            </View>

            <Text style={styles.label}>Age</Text>
            <View style={styles.inputShell}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.primary}
              />
              <TextInput
                value={age}
                onChangeText={(value) =>
                  setAge(value.replace(/[^0-9]/g, ""))
                }
                style={styles.input}
                placeholder="Child must be 6–15 years old"
                placeholderTextColor="#98A49F"
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.label}>Relationship to child</Text>
            <View style={styles.chipWrap}>
              {relationships.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setRelationship(item)}
                  style={({ pressed }) => [
                    styles.chip,
                    relationship === item && styles.chipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      relationship === item && styles.chipTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Location tracking</Text>
                <Text style={styles.cardSubtitle}>
                  The smartwatch is the required primary child-side device.
                </Text>
              </View>
              <View style={styles.safeTrackPill}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={13}
                  color={colors.primaryDark}
                />
                <Text style={styles.safeTrackText}>SafeTrack</Text>
              </View>
            </View>

            {sources.map((source) => {
              const chosen = trackingSource === source.value;

              return (
                <Pressable
                  key={source.value}
                  onPress={() => setTrackingSource(source.value)}
                  style={({ pressed }) => [
                    styles.sourceCard,
                    chosen && styles.sourceCardChosen,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.sourceIcon,
                      chosen && styles.sourceIconChosen,
                    ]}
                  >
                    <Ionicons
                      name={source.icon}
                      size={23}
                      color={chosen ? colors.white : colors.primary}
                    />
                  </View>

                  <View style={styles.sourceCopy}>
                    <Text
                      style={[
                        styles.sourceTitle,
                        chosen && styles.sourceTitleChosen,
                      ]}
                    >
                      {source.title}
                    </Text>
                    <Text style={styles.sourceDetail}>{source.detail}</Text>
                  </View>

                  <View
                    style={[styles.radio, chosen && styles.radioChosen]}
                  >
                    {chosen ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}

            <View style={styles.watchCard}>
              <View style={styles.watchHeading}>
                <Ionicons
                  name="watch-outline"
                  size={21}
                  color={colors.primary}
                />
                <Text style={styles.watchTitle}>Smartwatch connection</Text>
              </View>

              <Text style={styles.watchDescription}>
                Open SafeTrack on the Galaxy Watch8 and enter the Watch ID shown on its connection screen.
              </Text>

              <View style={styles.inputShell}>
                <Ionicons
                  name="link-outline"
                  size={20}
                  color={colors.muted}
                />
                <TextInput
                  value={watchId}
                  onChangeText={(value) => setWatchId(value.toUpperCase())}
                  style={styles.input}
                  placeholder="Example: ST-WATCH-ABC1234567"
                  placeholderTextColor="#98A49F"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          {registrationCompleted && !connection ? (
            <View style={styles.warningBox}>
              <Ionicons name="watch-outline" size={21} color={colors.primaryDark} />
              <Text style={styles.warningText}>
                The child and smartwatch are already linked. Tap below to retry generating the 6-digit connection code; SafeTrack will not create another child profile.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={21}
                color={colors.danger}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => void saveChild()}
            disabled={saving}
            style={({ pressed }) => [
              styles.button,
              (pressed || saving) && styles.pressed,
              saving && styles.disabled,
            ]}
          >
            <Ionicons
              name={registrationCompleted ? "key-outline" : "checkmark-outline"}
              size={20}
              color={colors.white}
            />
            <Text style={styles.buttonText}>
              {saving
                ? registrationCompleted
                  ? "Generating code..."
                  : "Completing setup..."
                : registrationCompleted
                  ? "Generate connection code"
                  : "Complete setup"}
            </Text>
          </Pressable>

          <View style={styles.privacyLine}>
            <Ionicons
              name="lock-closed-outline"
              size={13}
              color={colors.muted}
            />
            <Text style={styles.privacyText}>
              Your child&apos;s profile is visible only to authorized SafeTrack users.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 36,
  },
  stepArea: { alignItems: "center", marginTop: -32 },
  stepText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  stepRail: {
    width: 135,
    height: 6,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#DDECE4",
    marginTop: 8,
  },
  stepProgress: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primary,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.35,
    marginTop: 23,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 7,
  },
  registeringCard: {
    marginTop: 18,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  registerIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  registerCopy: { flex: 1, marginLeft: 10 },
  registerLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  registerName: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
    marginTop: 2,
  },
  card: {
    marginTop: 15,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  cardSubtitle: { color: colors.muted, fontSize: 10.5, marginTop: 2 },
  requiredPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
  },
  requiredText: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
  },
  safeTrackPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  safeTrackText: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
    marginLeft: 4,
  },
  label: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  inputShell: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...shadow.soft,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "600",
    marginLeft: 10,
    paddingVertical: 10,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginRight: 7,
    marginBottom: 7,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  chipTextSelected: { color: colors.white },
  sourceCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginTop: 9,
  },
  sourceCardChosen: {
    borderColor: colors.primary,
    backgroundColor: "#F2FBF6",
  },
  sourceIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  sourceIconChosen: { backgroundColor: colors.primary },
  sourceCopy: { flex: 1, marginLeft: 11 },
  sourceTitle: { color: colors.ink, fontSize: 14.5, fontWeight: "900" },
  sourceTitleChosen: { color: colors.primaryDark },
  sourceDetail: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  radio: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#B8CAC0",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
  },
  radioChosen: { borderColor: colors.primary },
  radioDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  watchCard: {
    marginTop: 14,
    padding: 13,
    borderRadius: radius.sm,
    backgroundColor: "#F4FBF8",
    borderWidth: 1,
    borderColor: "#DCEDE3",
  },
  watchHeading: { flexDirection: "row", alignItems: "center" },
  watchTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "900",
    marginLeft: 8,
  },
  watchDescription: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 7,
    marginBottom: 10,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    marginTop: 15,
    borderRadius: radius.sm,
    backgroundColor: colors.softMint,
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    marginTop: 15,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    color: "#A94747",
    fontSize: 12.5,
    lineHeight: 18,
  },
  button: {
    minHeight: 54,
    marginTop: 18,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    ...shadow.soft,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15.5,
    fontWeight: "900",
    marginLeft: 8,
  },
  secondaryButton: {
    minHeight: 50,
    marginTop: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 7,
  },
  privacyLine: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  privacyText: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
    marginLeft: 6,
    textAlign: "center",
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },

  // Connection-code screen
  codeContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    paddingBottom: 36,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.softMint,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  codeEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  codeTitle: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.6,
    textAlign: "center",
    marginTop: 6,
  },
  codeSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
    paddingHorizontal: 8,
  },
  codeCard: {
    marginTop: 20,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    ...shadow.card,
  },
  codeLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  codeValue: {
    color: colors.primaryDark,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 8,
    marginTop: 8,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  expiryText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 5,
  },
  linkedInfoCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkedRow: { flexDirection: "row", alignItems: "center" },
  linkedCopy: { flex: 1, marginLeft: 10 },
  linkedLabel: {
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  linkedValue: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
    marginTop: 2,
  },
  linkedDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  instructionCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.sm,
    backgroundColor: "#F4FBF8",
    borderWidth: 1,
    borderColor: "#DCEDE3",
  },
  instructionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  instructionText: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 19,
    marginTop: 6,
  },
  codeFootnote: {
    color: colors.muted,
    fontSize: 9.5,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 10,
  },
});
