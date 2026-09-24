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
import { useRouter } from "expo-router";
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

export default function EditGuardianProfileScreen() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const { data, error: profileError } = await supabase
        .from("persons")
        .select("id,full_name,email,avatar_path")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setId(auth.user.id);
      setName(data?.full_name ?? String(auth.user.user_metadata?.full_name ?? "Guardian"));
      setEmail(data?.email ?? auth.user.email ?? "");
      setPath(data?.avatar_path ?? null);
      setAvatar(await getProfileAvatarUrl(data?.avatar_path));
    } catch (reason) {
      Alert.alert(
        "Unable to load profile",
        reason instanceof Error ? reason.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async () => {
    try {
      const uri = await chooseProfileAvatar();
      if (uri) setSelected(uri);
    } catch (reason) {
      Alert.alert(
        "Unable to select photo",
        reason instanceof Error ? reason.message : "Please try again.",
      );
    }
  };

  const save = async () => {
    if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("Check your details", "Enter your full name and a valid email address.");
      return;
    }

    setSaving(true);
    try {
      let nextPath = path;
      if (selected) nextPath = await uploadProfileAvatar("guardian", id, selected, path);

      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: name.trim() },
        email: email.trim().toLowerCase(),
      });
      if (authError) throw authError;

      const { error: dbError } = await supabase.rpc("update_my_person_profile", {
        p_full_name: name.trim(),
        p_email: email.trim().toLowerCase(),
        p_avatar_path: nextPath,
      });
      if (dbError) throw dbError;

      router.back();
    } catch (reason) {
      Alert.alert(
        "Unable to save profile",
        reason instanceof Error ? reason.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          <SafeTrackBackButton />

          <Text style={styles.eyebrow}>GUARDIAN PROFILE</Text>
          <Text style={styles.title}>Keep your account recognizable.</Text>
          <Text style={styles.subtitle}>
            Update the identity details shown across your SafeTrack guardian experience.
          </Text>

          <View style={styles.identityBand}>
            <SafeTrackAvatar
              imageUri={selected || avatar}
              name={name}
              size={86}
              editable
              onPress={() => void choose()}
            />
            <View style={styles.identityCopy}>
              <Text style={styles.identityKicker}>PROFILE PHOTO</Text>
              <Text style={styles.identityTitle}>A familiar account at a glance</Text>
              <Text style={styles.identityText}>Tap the photo to choose a different image.</Text>
            </View>
          </View>

          <Text style={styles.sectionEyebrow}>ACCOUNT DETAILS</Text>

          <Text style={styles.label}>Full name</Text>
          <View style={styles.inputShell}>
            <View style={styles.fieldIcon}>
              <Ionicons name="person-outline" size={19} color={colors.primaryDark} />
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.label}>Email address</Text>
          <View style={styles.inputShell}>
            <View style={styles.fieldIcon}>
              <Ionicons name="mail-outline" size={19} color={colors.primaryDark} />
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={styles.noteBand}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.note}>
              Changing the email address may require confirmation, depending on your authentication setting.
            </Text>
          </View>

          <SafeTrackButton
            label="Save profile changes"
            icon="checkmark-outline"
            onPress={() => void save()}
            loading={saving}
            style={styles.save}
          />

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 80,
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
    letterSpacing: 1.45,
    marginTop: 20,
  },
  title: {
    maxWidth: 420,
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 6,
  },
  subtitle: {
    maxWidth: 430,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 7,
  },
  identityBand: {
    marginTop: 24,
    marginBottom: 28,
    padding: 17,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryDeep,
    ...shadow.card,
  },
  identityCopy: { flex: 1, minWidth: 0, marginLeft: 16 },
  identityKicker: {
    color: "rgba(255,255,255,.58)",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.15,
  },
  identityTitle: {
    marginTop: 4,
    color: colors.white,
    fontSize: 15.5,
    fontWeight: "900",
  },
  identityText: {
    marginTop: 4,
    color: "rgba(255,255,255,.72)",
    fontSize: 11.5,
    lineHeight: 17,
  },
  sectionEyebrow: {
    marginBottom: 4,
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  label: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...shadow.soft,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "600",
    marginLeft: 10,
    paddingVertical: 10,
  },
  noteBand: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  note: {
    flex: 1,
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginLeft: 9,
  },
  save: { marginTop: 24 },
  cancel: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 12.5,
    fontWeight: "800",
  },
  pressed: { opacity: 0.72 },
});
