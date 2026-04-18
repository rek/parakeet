import { typedSupabase } from '@platform/supabase';
import { captureException } from '@platform/utils/captureException';
import { normalizeVideoUri } from '@modules/video-analysis';
import { File } from 'expo-file-system';

const BUCKET = 'session-videos';

/**
 * Upload a compressed video to the *lifter's* storage folder.
 * Path: `{lifterUserId}/{videoId}.mp4`
 *
 * The partner storage policy from social-001 allows uploading to an accepted
 * partner's folder. Returns remote URI on success, null on failure (best-effort).
 */
export async function uploadPartnerVideo({
  lifterUserId,
  videoId,
  localUri,
}: {
  lifterUserId: string;
  videoId: string;
  localUri: string;
}) {
  try {
    const storagePath = `${lifterUserId}/${videoId}.mp4`;
    // expo-file-system's File declares `implements Blob` but the JS shim
    // doesn't expose Blob body/size — passing it directly uploads 0 bytes.
    // Read to ArrayBuffer first.
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

    const { data: urlData } = typedSupabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const remoteUri = urlData?.publicUrl ?? null;

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
