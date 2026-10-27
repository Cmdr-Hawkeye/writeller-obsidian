declare module 'jpeg-js/lib/decoder' {
  /** Browser decode-only entry; the build removes the unused upstream network loader. */
  export default function decode(bytes: Uint8Array, options: { useTArray: true; tolerantDecoding: false;
    maxResolutionInMP: number; maxMemoryUsageInMB: number }): { width: number; height: number; data: Uint8Array };
}
