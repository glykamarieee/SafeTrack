import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";

export async function chooseProfileAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo-library access is required to choose a profile picture.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.78,
  });
  return result.canceled ? null : result.assets[0]?.uri ?? null;
}

export async function uploadProfileAvatar(target: "guardian" | "child", ownerId: string, uri: string, previousPath?: string | null) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const path = `${target}/${ownerId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("profile-avatars").upload(path, blob, { upsert: false, contentType: `image/${extension === "jpg" ? "jpeg" : extension}` });
  if (error) throw error;
  if (previousPath && previousPath !== path) await supabase.storage.from("profile-avatars").remove([previousPath]);
  return path;
}

export async function getProfileAvatarUrl(path?: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("profile-avatars").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
