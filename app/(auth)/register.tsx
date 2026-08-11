import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SafeTrackBackButton } from "../../components/common/SafeTrackBackButton";
import { useAuthStore } from "../../store/authStore";
import { safeTrackColors as colors, safeTrackRadius as radius, safeTrackShadow as shadow, safeTrackSpacing as spacing } from "../../constants/safeTrackDesign";

function validEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }

type FieldProps = { label: string; icon: keyof typeof Ionicons.glyphMap; value: string; onChangeText: (value: string) => void; secure?: boolean; keyboardType?: "default" | "email-address"; autoCapitalize?: "none" | "words" };
function Field({ label, icon, value, onChangeText, secure = false, keyboardType = "default", autoCapitalize = "words" }: FieldProps) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputShell}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <TextInput value={value} onChangeText={onChangeText} style={styles.input} placeholder={label} placeholderTextColor="#97A49E" secureTextEntry={secure && !visible} autoCapitalize={autoCapitalize} autoCorrect={false} keyboardType={keyboardType} />
      {secure ? <Pressable onPress={() => setVisible((item) => !item)} hitSlop={8}><Ionicons name={visible ? "eye-outline" : "eye-off-outline"} size={20} color={colors.muted} /></Pressable> : null}
    </View>
  </View>;
}

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const createAccount = async () => {
    clearError(); setLocalError(null);
    if (fullName.trim().length < 2) return setLocalError("Enter your full name.");
    if (!validEmail(email.trim())) return setLocalError("Enter a valid email address.");
    if (password.length < 6) return setLocalError("Password must contain at least 6 characters.");
    if (password !== confirmPassword) return setLocalError("Passwords do not match.");
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password);
      await logout();
      router.replace("/(auth)/login");
    } catch {
      // Store exposes the relevant registration message.
    }
  };
  const displayError = localError ?? authError;

  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SafeTrackBackButton />
        <View style={styles.stepArea}><Text style={styles.stepText}>STEP 1 OF 2</Text><View style={styles.stepRail}><View style={styles.stepProgress} /></View></View>
        <Text style={styles.eyebrow}>GUARDIAN ACCOUNT SETUP</Text>
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Create your guardian account first. You can securely register your child and link a smartwatch in the next step.</Text>
        <View style={styles.card}>
          <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Guardian details</Text><Text style={styles.cardSubtitle}>Use an active email address you can access.</Text></View><View style={styles.securePill}><Ionicons name="shield-checkmark-outline" size={14} color={colors.primaryDark}/><Text style={styles.secureText}>Secure</Text></View></View>
          <Field label="Full name" icon="person-outline" value={fullName} onChangeText={setFullName}/>
          <Field label="Email address" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/>
          <Field label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secure autoCapitalize="none"/>
          <Field label="Confirm password" icon="shield-checkmark-outline" value={confirmPassword} onChangeText={setConfirmPassword} secure autoCapitalize="none"/>
          {displayError ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={20} color={colors.danger}/><Text style={styles.errorText}>{displayError}</Text></View> : null}
          <Pressable onPress={() => void createAccount()} disabled={isLoading} style={({pressed}) => [styles.button, (pressed || isLoading) && styles.pressed, isLoading && styles.disabled]}>
            <Ionicons name="person-add-outline" size={19} color={colors.white}/><Text style={styles.buttonText}>{isLoading ? "Creating account..." : "Create account"}</Text><Ionicons name="arrow-forward" size={19} color={colors.white} style={styles.buttonArrow}/>
          </Pressable>
        </View>
        <View style={styles.footerRow}><Text style={styles.footerText}>Already have an account? </Text><Link href="/(auth)/login" style={styles.footerLink}>Log in</Link></View>
        <View style={styles.noteRow}><Ionicons name="lock-closed-outline" size={13} color={colors.muted}/><Text style={styles.note}>Your information is protected by SafeTrack.</Text></View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background}, flex:{flex:1}, content:{paddingHorizontal:spacing.lg,paddingTop:16,paddingBottom:34},
  stepArea:{alignItems:"center",marginTop:-32}, stepText:{color:colors.primaryDark,fontSize:10,fontWeight:"900",letterSpacing:1.4}, stepRail:{width:135,height:6,borderRadius:6,backgroundColor:"#DDECE4",marginTop:8,overflow:"hidden"}, stepProgress:{width:"50%",height:"100%",backgroundColor:colors.primary,borderRadius:6},
  eyebrow:{color:colors.primary,fontSize:10,fontWeight:"900",letterSpacing:1.35,marginTop:23}, title:{color:colors.ink,fontSize:30,fontWeight:"900",letterSpacing:-0.8,marginTop:5}, subtitle:{color:colors.muted,fontSize:13.5,lineHeight:20,marginTop:7,maxWidth:330},
  card:{marginTop:22,padding:17,borderRadius:radius.md,backgroundColor:colors.white,borderWidth:1,borderColor:colors.border,...shadow.card}, cardHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}, cardTitle:{color:colors.ink,fontSize:16,fontWeight:"900"}, cardSubtitle:{color:colors.muted,fontSize:10.5,marginTop:2}, securePill:{flexDirection:"row",alignItems:"center",paddingHorizontal:8,paddingVertical:5,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted},secureText:{color:colors.primaryDark,fontSize:9.5,fontWeight:"900",marginLeft:4},
  field:{marginTop:11}, label:{color:colors.ink,fontSize:12.5,fontWeight:"900",marginBottom:6},inputShell:{minHeight:51,flexDirection:"row",alignItems:"center",paddingHorizontal:14,borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,backgroundColor:colors.white,...shadow.soft},input:{flex:1,color:colors.ink,fontSize:14.5,fontWeight:"600",marginLeft:10,paddingVertical:10},
  errorBox:{flexDirection:"row",alignItems:"flex-start",marginTop:13,padding:11,borderRadius:radius.sm,backgroundColor:colors.dangerSoft},errorText:{flex:1,marginLeft:8,color:"#A94747",fontSize:12,lineHeight:17},button:{minHeight:53,marginTop:17,borderRadius:radius.pill,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",flexDirection:"row",...shadow.soft},buttonText:{color:colors.white,fontSize:15,fontWeight:"900",marginLeft:7},buttonArrow:{position:"absolute",right:18},
  footerRow:{marginTop:18,flexDirection:"row",justifyContent:"center"},footerText:{color:colors.muted,fontSize:11.5},footerLink:{color:colors.primaryDark,fontSize:11.5,fontWeight:"900"},noteRow:{marginTop:11,flexDirection:"row",justifyContent:"center",alignItems:"center"},note:{color:colors.muted,fontSize:10.5,marginLeft:6},pressed:{opacity:.8,transform:[{scale:.985}]},disabled:{opacity:.55},
});
