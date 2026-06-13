import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "./supabase";

type Bucket = "avatars" | "receipts" | "group_covers";

const COMPRESS_OPTIONS: Record<Bucket, { maxWidth: number; quality: number }> = {
  avatars: { maxWidth: 256, quality: 0.7 },
  group_covers: { maxWidth: 512, quality: 0.75 },
  receipts: { maxWidth: 1024, quality: 0.8 }
};

const compressImage = async (uri: string, bucket: Bucket): Promise<string> => {
  const { maxWidth, quality } = COMPRESS_OPTIONS[bucket];
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

const uriToBlob = async (uri: string): Promise<Blob> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });
  return decode(base64) as unknown as Blob;
};

export const uploadFile = async (asset: ImagePickerAsset, bucket: Bucket) => {
  const compressedUri = await compressImage(asset.uri, bucket);
  const blob = await uriToBlob(compressedUri);

  const filePath = `${Date.now()}_${asset.fileName?.replace(/\.[^.]+$/, "")}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, blob, {
    cacheControl: "31536000",
    upsert: true,
    contentType: "image/jpeg"
  });

  if (error) {
    return { error: true, message: error.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { error: false, message: "File uploaded successfully", data };
};
