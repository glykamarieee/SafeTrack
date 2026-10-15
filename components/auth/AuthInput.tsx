import { Ionicons } from "@expo/vector-icons";
import type { TextInputProps } from "react-native";

import { Field } from "../ui/Field";

interface AuthInputProps extends Omit<TextInputProps, "style"> {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  errorText?: string;
}

/** Kept for existing screens; renders the shared Field. */
export function AuthInput({ label, icon, errorText, ...rest }: AuthInputProps) {
  return <Field label={label} icon={icon} error={errorText} {...rest} />;
}
