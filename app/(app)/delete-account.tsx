import { useState } from "react";
import { Text } from "../../components/ui/NativeText";
import { useRouter } from "expo-router";

import {
  AccountButton,
  AccountField,
  AccountMessage,
  AccountScreenFrame,
  accountStyles,
} from "../../components/profile/AccountScreenFrame";
import { useAuthStore } from "../../store/authStore";
import { deleteMyAccount } from "../../services/accountService";
import { showAlert } from "../../lib/platformAlert";

const CONFIRM_WORD = "DELETE";

/** A guardian deletes their own account (`delete_my_account`). */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const children = useAuthStore((state) => state.linkedChildren);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setError(null);
    if (!password) return setError("Enter your password.");
    if (typed.trim().toUpperCase() !== CONFIRM_WORD) return setError(`Type ${CONFIRM_WORD} to confirm.`);

    showAlert("Delete your SafeTrack account?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete account",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await deleteMyAccount(password);
            await logout();
            router.replace({ pathname: "/(auth)/login", params: { notice: "account-deleted" } });
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Your account could not be deleted.");
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <AccountScreenFrame title="Delete account" subtitle="Permanently close your guardian account." backTo="/(app)/profile">
      <Text style={accountStyles.note}>
        What happens:{"\n"}• You are signed out on every device and can no longer log in.{"\n"}• Your name, email, phone and photo are
        removed.{"\n"}• {children.length ? `Your ${children.length === 1 ? "child's profile is" : `${children.length} children's profiles are`} removed, ` : "Child profiles are removed, "}
        unless another guardian is linked to them; linked watches and phones are released.{"\n"}• Safe Zones stop working and
        notifications stop.{"\n"}• Past location, SOS and safety records are kept without your personal details, as required for
        safety records.
      </Text>
      <AccountMessage text={error} tone="error" />
      <AccountField label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" />
      <AccountField label={`Type ${CONFIRM_WORD} to confirm`} value={typed} onChangeText={setTyped} autoCapitalize="characters" />
      <AccountButton label="Delete my account" danger busy={busy} onPress={remove} />
    </AccountScreenFrame>
  );
}
