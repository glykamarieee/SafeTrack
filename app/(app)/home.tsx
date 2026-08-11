import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { GuardianHome } from "../../components/dashboard/GuardianHome";
import { AdminHome } from "../../components/dashboard/AdminHome";
import { safeTrackColors as colors } from "../../constants/safeTrackDesign";

export default function HomeScreen() {
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});