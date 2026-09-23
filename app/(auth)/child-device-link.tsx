import { useState } from "react";
import {
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
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { SafeTrackBackButton } from "../../components/common/SafeTrackBackButton";
import { useChildMobileStore } from "../../store/childMobileStore";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

export default function ChildDeviceLinkScreen() {
  const router = useRouter();

  const linkDevice = useChildMobileStore((state) => state.linkDevice);

  const isLoading = useChildMobileStore((state) => state.isLoading);

  const storeError = useChildMobileStore((state) => state.error);

  const clearError = useChildMobileStore((state) => state.clearError);

  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const linkChildDevice = async () => {
    clearError();
    setLocalError(null);

    const normalizedCode = code.replace(/\D/g, "");

    if (!/^\d{6}$/.test(normalizedCode)) {
      setLocalError(
        "Enter the six-digit child-device connection code provided by the Guardian.",
      );
      return;
    }

    try {
      await linkDevice(normalizedCode);

      /*
        Important:
        This explicitly targets the Child route group.
        Do not replace this with "/child-home".
      */
      router.replace("/(child)/child-home" as Href);
    } catch (error) {
      Alert.alert(
        "Unable to link child phone",
        error instanceof Error
          ? error.message
          : "SafeTrack could not link this child phone.",
      );
    }
  };

  const displayError = localError ?? storeError;

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

          <View style={styles.badge}>
            <Ionicons
              name="phone-portrait-outline"
              size={17}
              color={colors.primaryDark}
            />

            <Text style={styles.badgeText}>CHILD DEVICE ACCESS</Text>
          </View>

          <Text style={styles.title}>Link this child phone</Text>

          <Text style={styles.subtitle}>
            Enter the temporary connection code provided by the child&apos;s
            Guardian. This links only this phone to the registered child
            profile.
          </Text>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={25}
                color={colors.primary}
              />
            </View>

            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>For the child&apos;s phone</Text>

              <Text style={styles.infoText}>
                Do not use this screen while logged in as a Guardian or
                Administrator.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Device connection code</Text>

            <Text style={styles.cardText}>
              Ask the Guardian to open Child Mobile Access and generate a new
              temporary code.
            </Text>

            <Text style={styles.label}>Six-digit code</Text>

            <View style={styles.inputShell}>
              <Ionicons name="key-outline" size={22} color={colors.primary} />

              <TextInput
                value={code}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/g, ""));

                  setLocalError(null);
                  clearError();
                }}
                placeholder="EXAMPLE: 123456"
                placeholderTextColor="#9AA6A1"
                keyboardType="number-pad"
                autoCorrect={false}
                maxLength={6}
                style={styles.input}
              />
            </View>

            {displayError ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={colors.danger}
                />

                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={isLoading}
              onPress={() => void linkChildDevice()}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
                isLoading && styles.disabled,
              ]}
            >
              <Ionicons name="link-outline" size={21} color={colors.white} />

              <Text style={styles.linkButtonText}>
                {isLoading ? "Linking child device..." : "Link child device"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.note}>
            <Ionicons
              name="information-circle-outline"
              size={19}
              color={colors.primary}
            />

            <Text style={styles.noteText}>
              Once linked, this child phone can send location updates, view
              basic safe-zone status, and trigger SOS alerts.
            </Text>
          </View>
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
    paddingBottom: 40,
  },

  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginTop: 24,
  },

  badgeText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginLeft: 7,
  },

  title: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: 17,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 22,
    marginTop: 8,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 24,
    ...shadow.soft,
  },

  infoIcon: {
    width: 51,
    height: 51,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  infoCopy: {
    flex: 1,
    marginLeft: 12,
  },

  infoTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },

  infoText: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 3,
  },

  card: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 15,
    ...shadow.card,
  },

  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },

  cardText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  label: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
    marginTop: 21,
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
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginLeft: 11,
    paddingVertical: 11,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    marginTop: 13,
  },

  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 11.5,
    lineHeight: 17,
    marginLeft: 8,
  },

  linkButton: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 20,
  },

  linkButtonText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: "900",
    marginLeft: 8,
  },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 5,
    marginTop: 22,
  },

  noteText: {
    flex: 1,
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginLeft: 8,
  },

  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.58,
  },
});
