import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { SafeTrackBackButton } from "../../components/common/SafeTrackBackButton";
import { SafeTrackAvatar } from "../../components/common/SafeTrackAvatar";
import { SafeTrackButton } from "../../components/common/SafeTrackButton";

import {
  chooseProfileAvatar,
  getProfileAvatarUrl,
  uploadProfileAvatar,
} from "../../services/profileAvatarService";

import { supabase } from "../../lib/supabase";

import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";

const RELATIONSHIPS = [
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Sibling",
  "Other",
];

type TrackingSource = "smartwatch" | "mobile" | "both";
type EditSection = "details" | "tracking";

const TRACKING_SOURCES: Array<{
  value: TrackingSource;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    value: "smartwatch",
    label: "Watch",
    icon: "watch-outline",
  },
  {
    value: "mobile",
    label: "Phone",
    icon: "phone-portrait-outline",
  },
  {
    value: "both",
    label: "Both",
    icon: "git-compare-outline",
  },
];

function usesWatch(source: TrackingSource) {
  return source === "smartwatch" || source === "both";
}

function usesPhone(source: TrackingSource) {
  return source === "mobile" || source === "both";
}

export default function EditChildProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    childId?: string;
    section?: string;
  }>();

  const requestedChildId = String(params.childId ?? "").trim();
  const section: EditSection =
    params.section === "tracking" ? "tracking" : "details";

  const [childId, setChildId] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [relationship, setRelationship] = useState("Guardian");
  const [trackingSource, setTrackingSource] =
    useState<TrackingSource>("smartwatch");

  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [watchId, setWatchId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingConnectionCode, setOpeningConnectionCode] = useState(false);

  const loadChildProfile = useCallback(async () => {
    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const guardianId = authData.user.id;

      let childQuery = supabase
        .from("children")
        .select(
          `
          id,
          full_name,
          age,
          relationship,
          tracking_source,
          avatar_path
        `
        )
        .eq("guardian_id", guardianId);

      if (requestedChildId) {
        childQuery = childQuery.eq("id", requestedChildId);
      }

      const { data: child, error: childError } = await childQuery
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (childError) {
        throw childError;
      }

      if (!child) {
        router.replace("/(auth)/child-registration");
        return;
      }

      setChildId(child.id);
      setName(child.full_name ?? "");
      setAge(String(child.age ?? ""));
      setRelationship(child.relationship ?? "Guardian");

      const normalizedTrackingSource: TrackingSource =
        child.tracking_source === "mobile" || child.tracking_source === "both"
          ? child.tracking_source
          : "smartwatch";

      setTrackingSource(normalizedTrackingSource);
      setAvatarPath(child.avatar_path ?? null);
      setAvatarUrl(await getProfileAvatarUrl(child.avatar_path ?? null));

      const { data: watch, error: watchError } = await supabase
        .from("smartwatch_devices")
        .select("id, watch_id, child_id, is_active, paired_at")
        .eq("child_id", child.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (watchError) {
        throw watchError;
      }

      setWatchId(watch?.watch_id ?? "");
    } catch (reason) {
      Alert.alert(
        "Unable to load child profile",
        reason instanceof Error ? reason.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [requestedChildId, router]);

  useEffect(() => {
    void loadChildProfile();
  }, [loadChildProfile]);

  const chooseAvatar = async () => {
    try {
      const uri = await chooseProfileAvatar();
      if (uri) {
        setSelectedAvatar(uri);
      }
    } catch (reason) {
      Alert.alert(
        "Unable to select photo",
        reason instanceof Error ? reason.message : "Please try again."
      );
    }
  };

  const validateChildDetails = () => {
    const numericAge = Number(age);

    if (name.trim().length < 2) {
      Alert.alert("Check child details", "Enter the child's full name.");
      return null;
    }

    if (!Number.isInteger(numericAge) || numericAge < 6 || numericAge > 15) {
      Alert.alert("Check child details", "Enter an age from 6 to 15.");
      return null;
    }

    return numericAge;
  };

  const validateTracking = () => {
    const normalizedWatchId = watchId.trim().toUpperCase();

    if (usesWatch(trackingSource) && !normalizedWatchId) {
      Alert.alert(
        "Watch ID required",
        "Enter the Watch ID, or choose Phone as the tracking source."
      );
      return null;
    }

    return normalizedWatchId;
  };

  const requireSessionAndChild = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Your session has expired. Please log in again.");
    }

    if (!childId) {
      throw new Error("SafeTrack could not identify the child profile.");
    }
  };

  const linkWatchToChild = async (normalizedWatchId: string) => {
    if (!childId) {
      throw new Error("SafeTrack could not identify the child profile.");
    }

    const { error: linkError } = await supabase.rpc(
      "link_watch_to_my_child",
      {
        p_child_id: childId,
        p_watch_id: normalizedWatchId,
      }
    );

    if (linkError) {
      throw new Error(linkError.message);
    }
  };

  const updateChildRecord = async (options: {
    fullName: string;
    numericAge: number;
    relationshipValue: string;
    trackingSourceValue: TrackingSource;
    avatarPathValue: string | null;
  }) => {
    const { error: updateError } = await supabase.rpc(
      "update_my_child_profile",
      {
        p_child_id: childId,
        p_full_name: options.fullName,
        p_age: options.numericAge,
        p_relationship: options.relationshipValue,
        p_tracking_source: options.trackingSourceValue,
        p_avatar_path: options.avatarPathValue,
      }
    );

    if (updateError) {
      throw new Error(updateError.message);
    }
  };

  const saveChildDetails = async () => {
    const numericAge = validateChildDetails();
    if (numericAge === null) {
      return;
    }

    setSaving(true);

    try {
      await requireSessionAndChild();

      let nextAvatarPath = avatarPath;

      if (selectedAvatar) {
        nextAvatarPath = await uploadProfileAvatar(
          "child",
          childId,
          selectedAvatar,
          avatarPath
        );
      }

      await updateChildRecord({
        fullName: name.trim(),
        numericAge,
        relationshipValue: relationship,
        trackingSourceValue: trackingSource,
        avatarPathValue: nextAvatarPath,
      });

      setAvatarPath(nextAvatarPath);

      if (selectedAvatar) {
        setAvatarUrl(await getProfileAvatarUrl(nextAvatarPath));
        setSelectedAvatar(null);
      }

      Alert.alert(
        "Child details updated",
        "The child's profile details were saved successfully.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (reason) {
      Alert.alert(
        "Unable to save child details",
        reason instanceof Error ? reason.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const saveTrackingSource = async (options?: {
    openConnection?: "watch" | "phone";
  }) => {
    const normalizedWatchId = validateTracking();
    if (normalizedWatchId === null) {
      return;
    }

    const numericAge = Number(age);
    const shouldOpenConnection = options?.openConnection !== undefined;

    if (shouldOpenConnection) {
      setOpeningConnectionCode(true);
    } else {
      setSaving(true);
    }

    try {
      await requireSessionAndChild();

      if (usesWatch(trackingSource)) {
        await linkWatchToChild(normalizedWatchId);
        setWatchId(normalizedWatchId);
      }

      await updateChildRecord({
        fullName: name.trim(),
        numericAge,
        relationshipValue: relationship,
        trackingSourceValue: trackingSource,
        avatarPathValue: avatarPath,
      });

      if (options?.openConnection === "watch") {
        router.push({
          pathname: "/(app)/device-connection-code",
          params: {
            childId,
            childName: name.trim(),
            watchId: normalizedWatchId,
          },
        });
        return;
      }

      if (options?.openConnection === "phone") {
        router.push({
          pathname: "/(app)/connection-code",
          params: {
            childId,
            device: "phone",
          },
        });
        return;
      }

      Alert.alert(
        "Tracking source updated",
        "The child's registered tracking source was saved successfully.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (reason) {
      Alert.alert(
        shouldOpenConnection
          ? "Unable to open connection code"
          : "Unable to save tracking source",
        reason instanceof Error ? reason.message : "Please try again."
      );
    } finally {
      setSaving(false);
      setOpeningConnectionCode(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const isDetails = section === "details";

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
          <SafeTrackBackButton />

          <Text style={styles.eyebrow}>
            {isDetails ? "CHILD PROFILE" : "TRACKING SOURCE"}
          </Text>
          <Text style={styles.title}>
            {isDetails
              ? "Edit child details."
              : `${name || "Child"}'s device routing.`}
          </Text>
          <Text style={styles.subtitle}>
            {isDetails
              ? "Update identity, age, relationship, and profile photo."
              : "Choose the registered tracking source and manage its existing device connection options."}
          </Text>

          {isDetails ? (
            <>
              <View style={styles.profileHero}>
                <View style={styles.heroAccentOne} />
                <View style={styles.heroAccentTwo} />
                <SafeTrackAvatar
                  imageUri={selectedAvatar || avatarUrl}
                  name={name}
                  size={88}
                  editable
                  onPress={() => void chooseAvatar()}
                />

                <View style={styles.profileHeroCopy}>
                  <Text style={styles.profileHeroKicker}>MONITORED CHILD</Text>
                  <Text numberOfLines={1} style={styles.profileHeroName}>
                    {name || "Child profile"}
                  </Text>
                  <View style={styles.profileMetaRow}>
                    <Ionicons
                      name="person-outline"
                      size={14}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.profileMetaText}>
                      {age ? `${age} years old • ${relationship}` : relationship}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>BASIC DETAILS</Text>
                <Text style={styles.sectionTitle}>Who are you monitoring?</Text>
              </View>

              <Text style={styles.label}>Child&apos;s full name</Text>
              <View style={styles.inputShell}>
                <View style={styles.fieldIcon}>
                  <Ionicons
                    name="person-outline"
                    size={19}
                    color={colors.primaryDark}
                  />
                </View>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder="Child's full name"
                  placeholderTextColor={colors.mutedLight}
                  autoCapitalize="words"
                />
              </View>

              <Text style={styles.label}>Age</Text>
              <View style={styles.inputShell}>
                <View style={styles.fieldIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={19}
                    color={colors.primaryDark}
                  />
                </View>
                <TextInput
                  value={age}
                  onChangeText={(value) =>
                    setAge(value.replace(/[^0-9]/g, ""))
                  }
                  keyboardType="number-pad"
                  style={styles.input}
                  placeholder="6 - 15"
                  placeholderTextColor={colors.mutedLight}
                />
                <View style={styles.ageBadge}>
                  <Text style={styles.ageBadgeText}>AGES 6–15</Text>
                </View>
              </View>

              <Text style={styles.helperText}>
                SafeTrack is scoped for children aged 6 to 15 years old.
              </Text>

              <Text style={styles.label}>Relationship to child</Text>
              <View style={styles.chips}>
                {RELATIONSHIPS.map((item) => {
                  const selected = relationship === item;

                  return (
                    <Pressable
                      key={item}
                      onPress={() => setRelationship(item)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={colors.white}
                          style={styles.chipCheck}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <SafeTrackButton
                label="Save child details"
                icon="checkmark-outline"
                onPress={() => void saveChildDetails()}
                loading={saving}
                style={styles.save}
              />

              <Text style={styles.saveNote}>
                Only the child&apos;s profile details are changed here.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>DEVICE ROUTING</Text>
                <Text style={styles.sectionTitle}>
                  Choose the registered tracking source
                </Text>
              </View>

              <View style={styles.sources}>
                {TRACKING_SOURCES.map((option) => {
                  const selected = trackingSource === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setTrackingSource(option.value)}
                      style={({ pressed }) => [
                        styles.source,
                        selected && styles.sourceSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.sourceIcon,
                          selected && styles.sourceIconSelected,
                        ]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={20}
                          color={
                            selected ? colors.primaryDark : colors.muted
                          }
                        />
                      </View>
                      <Text
                        style={[
                          styles.sourceText,
                          selected && styles.sourceTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.trackingNotice}>
                <View style={styles.trackingNoticeIcon}>
                  <Ionicons
                    name="information"
                    size={15}
                    color={colors.primaryDark}
                  />
                </View>
                <Text style={styles.trackingNoticeText}>
                  {trackingSource === "both"
                    ? "Smartwatch remains the primary child-side device while the child phone can provide an additional location source."
                    : trackingSource === "mobile"
                      ? "This current profile is configured to use the child's phone as its tracking source."
                      : "The registered smartwatch is the child's primary SafeTrack location and SOS device."}
                </Text>
              </View>

              {usesWatch(trackingSource) ? (
                <>
                  <Text style={styles.label}>Watch ID</Text>
                  <View style={styles.inputShell}>
                    <View style={styles.fieldIcon}>
                      <Ionicons
                        name="watch-outline"
                        size={19}
                        color={colors.primaryDark}
                      />
                    </View>
                    <TextInput
                      value={watchId}
                      onChangeText={(value) => setWatchId(value.toUpperCase())}
                      style={styles.input}
                      placeholder="ST-WATCH-XXXXXXXX"
                      placeholderTextColor={colors.mutedLight}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>

                  <Text style={styles.helperText}>
                    Enter the Watch ID displayed by SafeTrack on the child&apos;s
                    Wear OS smartwatch.
                  </Text>

                  <View style={styles.connectionBand}>
                    <View style={styles.connectionHeader}>
                      <View style={styles.connectionIcon}>
                        <Ionicons
                          name="watch-outline"
                          size={22}
                          color={colors.primaryDark}
                        />
                      </View>
                      <View style={styles.connectionCopy}>
                        <Text style={styles.connectionTitle}>
                          Smartwatch connection
                        </Text>
                        <Text style={styles.connectionText}>
                          Create the temporary code that the child enters on the
                          Wear OS application.
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      disabled={saving || openingConnectionCode}
                      onPress={() =>
                        void saveTrackingSource({ openConnection: "watch" })
                      }
                      style={({ pressed }) => [
                        styles.connectionButton,
                        pressed && styles.pressed,
                        (saving || openingConnectionCode) && styles.buttonDisabled,
                      ]}
                    >
                      {openingConnectionCode ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Ionicons
                            name="key-outline"
                            size={18}
                            color={colors.white}
                          />
                          <Text style={styles.connectionButtonText}>
                            Generate child device code
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={16}
                            color={colors.white}
                          />
                        </>
                      )}
                    </Pressable>

                    <Text style={styles.connectionFootnote}>
                      Watch and child-phone connection codes are separate and
                      single-purpose.
                    </Text>
                  </View>
                </>
              ) : null}

              {usesPhone(trackingSource) ? (
                <View style={styles.connectionBand}>
                  <View style={styles.connectionHeader}>
                    <View style={styles.connectionIcon}>
                      <Ionicons
                        name="phone-portrait-outline"
                        size={22}
                        color={colors.primaryDark}
                      />
                    </View>
                    <View style={styles.connectionCopy}>
                      <Text style={styles.connectionTitle}>
                        Child phone connection
                      </Text>
                      <Text style={styles.connectionText}>
                        Generate the temporary code entered on the child phone
                        under Link child device.
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    disabled={saving || openingConnectionCode}
                    onPress={() =>
                      void saveTrackingSource({ openConnection: "phone" })
                    }
                    style={({ pressed }) => [
                      styles.connectionButton,
                      pressed && styles.pressed,
                      (saving || openingConnectionCode) && styles.buttonDisabled,
                    ]}
                  >
                    {openingConnectionCode ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <Ionicons
                          name="key-outline"
                          size={18}
                          color={colors.white}
                        />
                        <Text style={styles.connectionButtonText}>
                          Generate child phone code
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color={colors.white}
                        />
                      </>
                    )}
                  </Pressable>
                </View>
              ) : null}

              <SafeTrackButton
                label="Save tracking source"
                icon="checkmark-outline"
                onPress={() => void saveTrackingSource()}
                loading={saving}
                style={styles.save}
              />

              <Text style={styles.saveNote}>
                Changes here apply only to the child&apos;s registered tracking
                source and device setup.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 46,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  eyebrow: {
    marginTop: 20,
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.45,
  },
  title: {
    maxWidth: 360,
    marginTop: 6,
    color: colors.ink,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.75,
  },
  subtitle: {
    maxWidth: 420,
    marginTop: 7,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18.5,
  },
  profileHero: {
    minHeight: 126,
    marginTop: 22,
    padding: 17,
    borderRadius: radius.xl,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryDeep,
    ...shadow.card,
  },
  heroAccentOne: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    right: -28,
    top: -52,
    backgroundColor: "rgba(105,219,157,.13)",
  },
  heroAccentTwo: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    left: -48,
    bottom: -55,
    backgroundColor: "rgba(255,255,255,.07)",
  },
  profileHeroCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 15,
  },
  profileHeroKicker: {
    color: "rgba(255,255,255,.58)",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  profileHeroName: {
    marginTop: 4,
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
  },
  profileMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    backgroundColor: colors.mintGlow,
  },
  profileMetaText: {
    maxWidth: 220,
    marginLeft: 5,
    color: colors.primaryDeep,
    fontSize: 9,
    fontWeight: "800",
  },
  sectionHeader: {
    marginTop: 29,
    marginBottom: 4,
  },
  sectionEyebrow: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  inputShell: {
    minHeight: 60,
    paddingHorizontal: 11,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    ...shadow.soft,
  },
  fieldIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  input: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "700",
  },
  ageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  ageBadgeText: {
    color: colors.primaryDark,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  helperText: {
    marginTop: 7,
    paddingHorizontal: 4,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipCheck: {
    marginRight: 4,
  },
  chipText: {
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: "800",
  },
  chipTextSelected: {
    color: colors.white,
  },
  sources: {
    marginTop: 12,
    padding: 5,
    borderRadius: 23,
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
  },
  source: {
    flex: 1,
    minHeight: 74,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceSelected: {
    backgroundColor: colors.white,
    ...shadow.soft,
  },
  sourceIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceIconSelected: {
    backgroundColor: colors.softMint,
  },
  sourceText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "800",
  },
  sourceTextSelected: {
    color: colors.primaryDark,
  },
  trackingNotice: {
    marginTop: 10,
    padding: 13,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.softMint,
  },
  trackingNoticeIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  trackingNoticeText: {
    flex: 1,
    marginLeft: 9,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  connectionBand: {
    marginTop: 21,
    padding: 15,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  connectionIcon: {
    width: 47,
    height: 47,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  connectionCopy: {
    flex: 1,
    marginLeft: 11,
  },
  connectionTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },
  connectionText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  connectionButton: {
    minHeight: 50,
    marginTop: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
  },
  connectionButtonText: {
    flex: 1,
    marginHorizontal: 8,
    color: colors.white,
    textAlign: "center",
    fontSize: 11.5,
    fontWeight: "900",
  },
  connectionFootnote: {
    marginTop: 8,
    color: colors.muted,
    textAlign: "center",
    fontSize: 9.5,
    lineHeight: 14,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  save: {
    marginTop: 20,
  },
  saveNote: {
    marginTop: 9,
    paddingHorizontal: 16,
    color: colors.muted,
    textAlign: "center",
    fontSize: 9.5,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
