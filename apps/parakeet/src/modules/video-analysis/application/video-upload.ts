import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';
import { File } from 'expo-file-system';

import { normalizeVideoUri } from '../lib/normalize-video-uri';

const BUCKET = 'session-videos';

/**
 * Upload a compressed video to Supabase Storage and update the session_videos
 * row with the remote URI.
 *
 * File path in storage: `{userId}/{videoId}.mp4`
 * Uploads the compressed local file — never the raw source.
 *
 * Returns the remote URI on success, null on failure (logged, not thrown).
 * This is a best-effort background operation — local video is always the
 * source of truth.
 */
export async function uploadVideoToStorage({
  videoId,
  localUri,
}: {
  videoId: string;
  localUri: string;
}) {
  try {
    const {
      data: { user },
    } = await typedSupabase.auth.getUser();
    if (!user) return null;

    const storagePath = `${user.id}/${videoId}.mp4`;

    // expo-file-system's File class declares `implements Blob` but its JS
    // shim doesn't actually expose Blob body/size, so passing it to Supabase
    // Storage uploads 0 bytes. Read to ArrayBuffer first and upload the bytes.
    const file = new File(normalizeVideoUri(localUri));
    if (!file.exists) {
      captureException(new Error(`Local video file missing: ${localUri}`));
      return null;
    }
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength === 0) {
      captureException(
        new Error(`Local video file is empty (0 bytes): ${localUri}`)
      );
      return null;
    }

    const { error: uploadError } = await typedSupabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadError) {
      captureException(uploadError);
      return null;
    }

    // Get the download URL
    const { data: urlData } = typedSupabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const remoteUri = urlData?.publicUrl ?? null;

    // Update the DB row with the remote URI
    if (remoteUri) {
      const { error: updateError } = await typedSupabase
        .from('session_videos')
        .update({ remote_uri: remoteUri })
        .eq('id', videoId);

      if (updateError) {
        captureException(updateError);
      }
    }

    return remoteUri;
  } catch (err) {
    captureException(err);
    return null;
  }
}
