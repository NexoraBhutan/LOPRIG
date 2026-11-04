/** How the API says a lesson's video plays. Bunny links are short-lived, so never store them. */
export type PlaybackSource = "" | "BUNNY" | "YOUTUBE" | "VIMEO" | "FILE";

export interface Playback {
  source: PlaybackSource;
  url: string;
}

/** Hosted players (iframe) bring their own play/speed controls; FILE plays in a plain <video>. */
export const isEmbedded = (p?: Playback | null) => !!p && ["BUNNY", "YOUTUBE", "VIMEO"].includes(p.source);
