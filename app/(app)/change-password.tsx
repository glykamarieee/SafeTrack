import { useState } from "react";

import {
  AccountButton,
  AccountField,
  AccountMessage,
  AccountScreenFrame,
  accountStyles,
} from "../../components/profile/AccountScreenFrame";
import { Text } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { MIN_PASSWORD_LENGTH, changeMyPassword, passwordProblem } from "../../services/supabaseAuthService";

/** Change password for guardians and administrators (current password required). */
export default function ChangePasswordScreen() {
  const role = useAuthStore((state) => state.role);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setDone(null);

    if (!current) return setError("Enter your current password.");
    const invalid = passwordProblem(next, confirm);
    if (invalid) return setError(invalid);
    if (next === current) return setError("The new password must be different from the current one.");

    setBusy(true);
    try {
      await changeMyPassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone("Password changed. Use the new password next time you log in.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The password could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountScreenFrame
      title="Change password"
      subtitle="You'll stay signed in on this device."
      backTo={role === "admin" ? "/(app)/admin-profile" : "/(app)/profile"}
    >
      <Text style={accountStyles.note}>Forgot your current password? Log out and use "Forgot password?" on the login screen.</Text>
      <AccountMessage text={error} tone="error" />
      <AccountMessage text={done} tone="success" />
      <AccountField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry textContentType="password" />
      <AccountField
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        textContentType="newPassword"
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
      />
      <AccountField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" />
      <AccountButton label="Change password" onPress={() => void save()} busy={busy} />
    </AccountScreenFrame>
  );
}
