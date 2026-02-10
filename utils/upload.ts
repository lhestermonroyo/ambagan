import { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from './supabase';

type Bucket = 'avatars' | 'group_covers' | 'receipt_images';

const uriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob;
};

export const uploadFile = async (asset: ImagePickerAsset, bucket: Bucket) => {
  const blob = await uriToBlob(asset.uri);

  const filePath = `${Date.now()}_${asset.fileName}`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, blob, {
    cacheControl: '3600',
    upsert: true,
    contentType: asset.mimeType
  });

  if (error) {
    return { error: true, message: error.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { error: false, message: 'File uploaded successfully', data };
};
