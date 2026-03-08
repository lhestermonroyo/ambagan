import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "./supabase";

type Bucket = "avatars" | "receipts" | "group_covers";

const uriToBlob = async (uri: string): Promise<Blob> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });
  return decode(base64) as unknown as Blob;
};

export const uploadFile = async (asset: ImagePickerAsset, bucket: Bucket) => {
  const blob = await uriToBlob(asset.uri);

  const filePath = `${Date.now()}_${asset.fileName}`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: asset.mimeType
  });

  if (error) {
    return { error: true, message: error.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { error: false, message: "File uploaded successfully", data };
};
