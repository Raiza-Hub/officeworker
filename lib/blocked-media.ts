const BLOCKED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv"];
const BLOCKED_AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "flac",
];

export const BLOCKED_MEDIA_MESSAGE =
  "Video and audio files aren't supported";

export function isBlockedMediaFile(file: {
  name: string;
  type?: string;
}): boolean {
  const mediaType = file.type ?? "";
  if (mediaType.startsWith("video/") || mediaType.startsWith("audio/")) {
    return true;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  return (
    BLOCKED_VIDEO_EXTENSIONS.includes(extension ?? "") ||
    BLOCKED_AUDIO_EXTENSIONS.includes(extension ?? "")
  );
}
