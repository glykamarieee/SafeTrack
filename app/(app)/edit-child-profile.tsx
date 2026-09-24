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
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

const RELATIONSHIPS = [
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Sibling",
  "Other",
];

type TrackingSource = "smartwatch" | "mobile" | "both";

const TRACKING_SOURCES: Array<{
  value: TrackingSource;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}> = [
  {
    value: "smartwatch",
    label: "Watch",
    icon: "watch-outline",
    description: "Galaxy Watch is the primary tracking device.",
  },
  {
    value: "mobile",
    label: "Phone",
    icon: "phone-portrait-outline",
    description: "The child's phone is the only tracking device.",
  },
  {
    value: "both",
    label: "Both",
    icon: "git-compare-outline",
    description: "Watch remains primary; child phone is optional.",
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
  const params = useLocalSearchParams<{ childId?: string }>();
  const requestedChildId = String(params.childId ?? "").trim();

  const [childId, setChildId] = useState("");

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [relationship, setRelationship] = useState("Guardian");

  const [trackingSource, setTrackingSource] =
    useState<TrackingSource>("smartwatch");

  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  /** Watch ID field; linkedWatchId is what the server has linked. */
  const [watchId, setWatchId] = useState("");
  const [linkedWatchId, setLinkedWatchId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingConnectionCode, setOpeningConnectionCode] = useState(false);
  const [unlinkingWatch, setUnlinkingWatch] = useState(false);

  const busy = saving || openingConnectionCode || unlinkingWatch;

  /**
   * ----------------------------------------------------------
   * LOAD CHILD PROFILE
   * ----------------------------------------------------------
   */
  const loadChildProfile = useCallback(async () => {
    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      const guardianId = authData.user.id;

      /**
       * Edit the child passed by the caller; otherwise the
       * first registered child, the same one the Guardian
       * home screen generates connection codes for.
       */
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

      const {
        data: child,
        error: childError,
      } = await childQuery
        .order("created_at", {
          ascending: true,
        })
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
        child.tracking_source === "mobile" ||
        child.tracking_source === "both"
          ? child.tracking_source
          : "smartwatch";

      setTrackingSource(normalizedTrackingSource);

      setAvatarPath(child.avatar_path ?? null);

      const resolvedAvatar = await getProfileAvatarUrl(
        child.avatar_path ?? null
      );

      setAvatarUrl(resolvedAvatar);

      /**
       * Find the smartwatch associated with this child.
       */
      const {
        data: watch,
        error: watchError,
      } = await supabase
        .from("smartwatch_devices")
        .select(
          `
          id,
          watch_id,
          child_id,
          is_active,
          paired_at
        `
        )
        .eq("child_id", child.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (watchError) {
        throw watchError;
      }

      setWatchId(watch?.watch_id ?? "");
      setLinkedWatchId(watch?.watch_id ?? "");
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Please try again.";

      Alert.alert(
        "Unable to load child profile",
        message
      );
    } finally {
      setLoading(false);
    }
  }, [router, requestedChildId]);

  useEffect(() => {
    void loadChildProfile();
  }, [loadChildProfile]);

  /**
   * ----------------------------------------------------------
   * CHOOSE PROFILE PHOTO
   * ----------------------------------------------------------
   */
  const chooseAvatar = async () => {
    try {
      const uri = await chooseProfileAvatar();

      if (uri) {
        setSelectedAvatar(uri);
      }
    } catch (reason) {
      Alert.alert(
        "Unable to select photo",
        reason instanceof Error
          ? reason.message
          : "Please try again."
      );
    }
  };

  /**
   * ----------------------------------------------------------
   * VALIDATE FORM
   * ----------------------------------------------------------
   */
  const validateForm = () => {
    const numericAge = Number(age);

    if (name.trim().length < 2) {
      Alert.alert(
        "Check child details",
        "Enter the child's full name."
      );

      return null;
    }

    if (
      !Number.isInteger(numericAge) ||
      numericAge < 6 ||
      numericAge > 15
    ) {
      Alert.alert(
        "Check child details",
        "Enter an age from 6 to 15."
      );

      return null;
    }

    const normalizedWatchId = watchId
      .trim()
      .toUpperCase();

    if (usesWatch(trackingSource) && !normalizedWatchId) {
      Alert.alert(
        "Watch ID required",
        "Enter the Watch ID, or choose Phone as the tracking source."
      );

      return null;
    }

    return {
      numericAge,
      normalizedWatchId,
    };
  };

  /**
   * ----------------------------------------------------------
   * LINK WATCH TO CHILD
   * ----------------------------------------------------------
   */
  const linkWatchToChild = async (
    normalizedWatchId: string
  ) => {
    if (!childId) {
      throw new Error(
        "SafeTrack could not identify the child profile."
      );
    }

    /**
     * Runs server-side: guardians cannot update
     * smartwatch_devices directly. The server checks
     * the Watch exists, is active and is not linked to
     * another child, and releases this child's previous
     * Watch.
     */
    const {
      error: linkError,
    } = await supabase.rpc(
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

  /**
   * ----------------------------------------------------------
   * UNLINK WATCH FROM CHILD
   * ----------------------------------------------------------
   */
  const unlinkWatch = async () => {
    if (!childId) {
      return;
    }

    setUnlinkingWatch(true);

    try {
      /**
       * Server-side, like linking. The watch loses its
       * device token and returns to its connection screen.
       */
      const {
        error: unlinkError,
      } = await supabase.rpc(
        "unlink_watch_from_my_child",
        {
          p_child_id: childId,
        }
      );

      if (unlinkError) {
        throw new Error(unlinkError.message);
      }

      setLinkedWatchId("");
      setWatchId("");

      Alert.alert(
        "Watch unlinked",
        "Enter a new Watch ID and save to link another smartwatch."
      );
    } catch (reason) {
      Alert.alert(
        "Unable to unlink watch",
        reason instanceof Error
          ? reason.message
          : "Please try again."
      );
    } finally {
      setUnlinkingWatch(false);
    }
  };

  const confirmUnlinkWatch = () => {
    Alert.alert(
      "Unlink watch?",
      `${linkedWatchId} will stop tracking ${name.trim() || "this child"}. To use it again, link it and enter a new connection code on the watch.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Unlink",
          style: "destructive",
          onPress: () => {
            void unlinkWatch();
          },
        },
      ]
    );
  };

  /**
   * ----------------------------------------------------------
   * SAVE CHILD PROFILE
   * ----------------------------------------------------------
   */
  const saveChildProfile = async (
    options?: {
      /** After saving, open the connection-code screen for this device. */
      openConnection?: "watch" | "phone";
    }
  ) => {
    const validated = validateForm();

    if (!validated) {
      return;
    }

    const {
      numericAge,
      normalizedWatchId,
    } = validated;

    const shouldOpenConnection =
      options?.openConnection !== undefined;

    if (shouldOpenConnection) {
      setOpeningConnectionCode(true);
    } else {
      setSaving(true);
    }

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      if (!childId) {
        throw new Error(
          "SafeTrack could not identify the child profile."
        );
      }

      let nextAvatarPath = avatarPath;

      if (selectedAvatar) {
        nextAvatarPath = await uploadProfileAvatar(
          "child",
          childId,
          selectedAvatar,
          avatarPath
        );
      }

      /**
       * Confirm and link the physical Watch first.
       * A phone-only child keeps any watch linked
       * earlier, in case the Guardian switches back.
       */
      if (usesWatch(trackingSource)) {
        await linkWatchToChild(
          normalizedWatchId
        );

        setWatchId(normalizedWatchId);
        setLinkedWatchId(normalizedWatchId);
      }

      /**
       * Update child profile.
       */
      const {
        error: updateError,
      } = await supabase.rpc(
        "update_my_child_profile",
        {
          p_child_id: childId,
          p_full_name: name.trim(),
          p_age: numericAge,
          p_relationship: relationship,
          p_tracking_source: trackingSource,
          p_avatar_path: nextAvatarPath,
        }
      );

      if (updateError) {
        throw new Error(updateError.message);
      }

      setAvatarPath(nextAvatarPath);

      if (selectedAvatar) {
        const nextAvatarUrl =
          await getProfileAvatarUrl(
            nextAvatarPath
          );

        setAvatarUrl(nextAvatarUrl);
        setSelectedAvatar(null);
      }

      /**
       * ------------------------------------------------------
       * CONNECTION CODES
       * ------------------------------------------------------
       *
       * Opened only after saving, so the server sees the
       * tracking source the Guardian just chose.
       */
      if (options?.openConnection === "watch") {
        router.push({
          pathname:
            "/(app)/device-connection-code",
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
        "Child profile updated",
        "The child's SafeTrack profile was saved successfully.",
        [
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Please try again.";

      Alert.alert(
        shouldOpenConnection
          ? "Unable to generate Watch connection code"
          : "Unable to save child profile",
        message
      );
    } finally {
      setSaving(false);
      setOpeningConnectionCode(false);
    }
  };

  /**
   * ----------------------------------------------------------
   * LOADING
   * ----------------------------------------------------------
   */
  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </SafeAreaView>
    );
  }

  /**
   * ----------------------------------------------------------
   * SCREEN
   * ----------------------------------------------------------
   */
  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SafeTrackBackButton />

          <Text style={styles.eyebrow}>
            CHILD ACCOUNT
          </Text>

          <Text style={styles.title}>
            Edit child profile
          </Text>

          <Text style={styles.subtitle}>
            Update the child details and registered
            smartwatch used by SafeTrack.
          </Text>

          {/* PROFILE PHOTO */}

          <View style={styles.photoRow}>
            <SafeTrackAvatar
              imageUri={
                selectedAvatar ||
                avatarUrl
              }
              name={name}
              size={82}
              editable
              onPress={() =>
                void chooseAvatar()
              }
            />

            <View style={styles.photoCopy}>
              <Text style={styles.photoTitle}>
                {name || "Child profile"}
              </Text>

              <Text style={styles.photoText}>
                {linkedWatchId
                  ? `Watch ${linkedWatchId} is linked`
                  : "Tap the photo to choose an image."}
              </Text>
            </View>
          </View>

          {/* FULL NAME */}

          <Text style={styles.label}>
            Child&apos;s full name
          </Text>

          <View style={styles.inputShell}>
            <Ionicons
              name="person-outline"
              size={21}
              color={colors.primary}
            />

            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Child's full name"
              placeholderTextColor={
                colors.muted
              }
              autoCapitalize="words"
            />
          </View>

          {/* AGE */}

          <Text style={styles.label}>
            Age
          </Text>

          <View style={styles.inputShell}>
            <Ionicons
              name="calendar-outline"
              size={21}
              color={colors.primary}
            />

            <TextInput
              value={age}
              onChangeText={(value) =>
                setAge(
                  value.replace(
                    /[^0-9]/g,
                    ""
                  )
                )
              }
              keyboardType="number-pad"
              style={styles.input}
              placeholder="6 - 15"
              placeholderTextColor={
                colors.muted
              }
            />
          </View>

          <Text style={styles.scope}>
            SafeTrack is scoped for children
            aged 6 to 15 years old.
          </Text>

          {/* RELATIONSHIP */}

          <Text style={styles.label}>
            Relationship
          </Text>

          <View style={styles.chips}>
            {RELATIONSHIPS.map(
              (item) => {
                const selected =
                  relationship === item;

                return (
                  <Pressable
                    key={item}
                    onPress={() =>
                      setRelationship(
                        item
                      )
                    }
                    style={[
                      styles.chip,
                      selected &&
                        styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          {/* TRACKING SOURCE */}

          <Text style={styles.label}>
            Tracking source
          </Text>

          <View style={styles.sources}>
            {TRACKING_SOURCES.map(
              (option) => {
                const selected =
                  trackingSource ===
                  option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setTrackingSource(
                        option.value
                      )
                    }
                    style={[
                      styles.source,
                      selected &&
                        styles.sourceSelected,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={
                        selected
                          ? colors.primaryDark
                          : colors.muted
                      }
                    />

                    <Text
                      style={[
                        styles.sourceText,
                        selected &&
                          styles.sourceTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          <View style={styles.trackingNotice}>
            <Ionicons
              name="shield-checkmark-outline"
              size={19}
              color={colors.primary}
            />

            <Text style={styles.trackingNoticeText}>
              {trackingSource === "both"
                ? "The smartwatch remains the primary child safety device. The child's phone is optional."
                : trackingSource === "mobile"
                  ? "The child's phone shares location and sends SOS alerts. No smartwatch is required."
                  : "The registered smartwatch is the child's primary SafeTrack device."}
            </Text>
          </View>

          {/* LINKED WATCH */}

          {linkedWatchId ? (
            <View style={styles.linkedWatch}>
              <Ionicons
                name="watch-outline"
                size={21}
                color={colors.primary}
              />

              <View style={styles.linkedWatchCopy}>
                <Text style={styles.linkedWatchLabel}>
                  Linked watch
                </Text>

                <Text
                  style={styles.linkedWatchId}
                  numberOfLines={1}
                >
                  {linkedWatchId}
                </Text>
              </View>

              <Pressable
                disabled={busy}
                onPress={confirmUnlinkWatch}
                style={({ pressed }) => [
                  styles.unlinkButton,
                  pressed &&
                    styles.connectionButtonPressed,
                  busy &&
                    styles.connectionButtonDisabled,
                ]}
              >
                {unlinkingWatch ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.danger}
                  />
                ) : (
                  <Text style={styles.unlinkButtonText}>
                    Unlink
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {usesWatch(trackingSource) ? (
          <>
          {/* WATCH ID */}

          <Text style={styles.label}>
            {linkedWatchId
              ? "Link a different watch"
              : "Watch ID"}
          </Text>

          <View style={styles.inputShell}>
            <Ionicons
              name="watch-outline"
              size={21}
              color={colors.primary}
            />

            <TextInput
              value={watchId}
              onChangeText={(value) =>
                setWatchId(
                  value.toUpperCase()
                )
              }
              style={styles.input}
              placeholder="ST-WATCH-XXXXXXXX"
              placeholderTextColor={
                colors.muted
              }
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.watchHelp}>
            Enter the Watch ID displayed by
            SafeTrack on the child&apos;s Wear OS
            smartwatch.
            {linkedWatchId
              ? " Saving a different ID replaces the linked watch, and the new watch needs a connection code."
              : ""}
          </Text>

          {/* WATCH CONNECTION */}

          <View style={styles.watchCard}>
            <View style={styles.watchCardHeader}>
              <View
                style={styles.watchIcon}
              >
                <Ionicons
                  name="watch-outline"
                  size={24}
                  color={colors.primary}
                />
              </View>

              <View style={styles.watchCardCopy}>
                <Text
                  style={styles.watchCardTitle}
                >
                  Child smartwatch
                </Text>

                <Text
                  style={styles.watchCardText}
                >
                  Generate the temporary
                  connection code that must be
                  entered on the child&apos;s
                  Wear OS Watch.
                </Text>
              </View>
            </View>

            <Pressable
              disabled={busy}
              onPress={() =>
                void saveChildProfile({
                  openConnection: "watch",
                })
              }
              style={({ pressed }) => [
                styles.connectionButton,
                pressed &&
                  styles.connectionButtonPressed,
                busy &&
                  styles.connectionButtonDisabled,
              ]}
            >
              {openingConnectionCode ? (
                <ActivityIndicator
                  size="small"
                  color={colors.white}
                />
              ) : (
                <>
                  <Ionicons
                    name="key-outline"
                    size={20}
                    color={colors.white}
                  />

                  <Text
                    style={
                      styles.connectionButtonText
                    }
                  >
                    Generate Child Device
                    Connection Code
                  </Text>
                </>
              )}
            </Pressable>

            <Text
              style={styles.connectionFootnote}
            >
              This code is for the registered
              smartwatch. It is different from
              Child Mobile Access.
            </Text>
          </View>
          </>
          ) : null}

          {/* PHONE CONNECTION */}

          {usesPhone(trackingSource) ? (
            <View style={styles.watchCard}>
              <View style={styles.watchCardHeader}>
                <View style={styles.watchIcon}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={24}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.watchCardCopy}>
                  <Text style={styles.watchCardTitle}>
                    Child phone
                  </Text>

                  <Text style={styles.watchCardText}>
                    Generate the temporary
                    connection code that must be
                    entered on the child&apos;s
                    phone under &quot;Link child
                    device&quot;.
                  </Text>
                </View>
              </View>

              <Pressable
                disabled={busy}
                onPress={() =>
                  void saveChildProfile({
                    openConnection: "phone",
                  })
                }
                style={({ pressed }) => [
                  styles.connectionButton,
                  pressed &&
                    styles.connectionButtonPressed,
                  busy &&
                    styles.connectionButtonDisabled,
                ]}
              >
                {openingConnectionCode ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="key-outline"
                      size={20}
                      color={colors.white}
                    />

                    <Text
                      style={
                        styles.connectionButtonText
                      }
                    >
                      Generate Child Phone
                      Connection Code
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* SAVE */}

          <SafeTrackButton
            label="Save child profile"
            icon="checkmark-outline"
            onPress={() =>
              void saveChildProfile()
            }
            loading={saving}
            disabled={busy}
            style={styles.save}
          />
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
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 36,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 20,
  },

  title: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: "900",
    marginTop: 5,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 7,
  },

  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 18,
  },

  photoCopy: {
    flex: 1,
    marginLeft: 14,
  },

  photoTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  photoText: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },

  label: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "900",
    marginTop: 14,
    marginBottom: 8,
  },

  inputShell: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
    paddingVertical: 10,
  },

  scope: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginRight: 8,
    marginBottom: 8,
  },

  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },

  chipTextSelected: {
    color: colors.white,
  },

  sources: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },

  source: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
  },

  sourceSelected: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    ...shadow.soft,
  },

  sourceText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },

  sourceTextSelected: {
    color: colors.primaryDark,
  },

  trackingNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 13,
    marginTop: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },

  trackingNoticeText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 9,
  },

  linkedWatch: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginTop: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  linkedWatchCopy: {
    flex: 1,
    marginLeft: 12,
  },

  linkedWatchLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  linkedWatchId: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },

  unlinkButton: {
    minWidth: 82,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  unlinkButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
  },

  watchHelp: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  watchCard: {
    marginTop: 22,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  watchCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  watchIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },

  watchCardCopy: {
    flex: 1,
    marginLeft: 12,
  },

  watchCardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },

  watchCardText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  connectionButton: {
    minHeight: 54,
    marginTop: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  connectionButtonPressed: {
    opacity: 0.88,
  },

  connectionButtonDisabled: {
    opacity: 0.6,
  },

  connectionButtonText: {
    flexShrink: 1,
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    marginLeft: 8,
  },

  connectionFootnote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10,
  },

  save: {
    marginTop: 18,
  },
});