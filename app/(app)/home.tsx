import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { GuardianHome } from "../../components/dashboard/GuardianHome";
import { AdminHome } from "../../components/dashboard/AdminHome";
import { safeTrackColors as colors } from "../../constants/safeTrackDesign";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { safeTrackPalette } from "../../theme/legacy";

export default function HomeScreen() {
  const styles = useStyles();
  const colors = safeTrackPalette(useTheme().colors);

  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const role = useAuthStore((state) => state.role);

  if (!isBootstrapped) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (role === "admin") {
    return <AdminHome />;
  }

  if (role === "guardian") {
    return <GuardianHome />;
  }

  return <Redirect href="/(auth)/login" />;
}

const useStyles = makeStyles((__c) => {
  const colors = safeTrackPalette(__c);
  return StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
});