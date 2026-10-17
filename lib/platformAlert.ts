import { Alert, Platform } from "react-native";
import { playSound } from "./sounds";

export interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

// A result message gets a matching sound; questions ("Delete…?") get none.
const ERROR_TITLE = /unable|failed|fail|could ?n[o']t|can't|cannot|unavailable|error|incorrect|invalid|not saved/i;
const SUCCESS_TITLE = /saved|created|updated|acknowledged|linked|connected|deleted|removed|added|sent|copied|downloaded|exported|changed|unlinked|done|ready/i;

function soundFor(title: string) {
  if (title.trim().endsWith("?")) return;
  if (ERROR_TITLE.test(title)) playSound("error");
  else if (SUCCESS_TITLE.test(title)) playSound("success");
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  soundFor(title);

  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  // react-native-web's Alert.alert is a no-op, so fall back to browser dialogs.
  const fullMessage = [title, message].filter(Boolean).join("\n\n");

  if (!buttons || buttons.length <= 1) {
    window.alert(fullMessage);
    buttons?.[0]?.onPress?.();
    return;
  }

  const confirmed = window.confirm(fullMessage);
  const confirmButton = buttons.find((b) => b.style !== "cancel");
  const cancelButton = buttons.find((b) => b.style === "cancel");
  if (confirmed) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
