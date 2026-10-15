import { Field } from "../ui/Field";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  errorText?: string;
  placeholder?: string;
}

/** Kept for existing screens; renders the shared Field with a show/hide toggle. */
export function PasswordField({ label, value, onChangeText, errorText, placeholder = "••••••••" }: PasswordFieldProps) {
  return (
    <Field
      label={label}
      icon="lock-closed-outline"
      secure
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoCapitalize="none"
      error={errorText}
    />
  );
}
