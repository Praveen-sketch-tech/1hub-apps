export interface AudioCapabilityInfo {
  preserveAudioRequested: boolean
  note: string
}

export function describeAudioCapability(preserveAudioRequested: boolean): AudioCapabilityInfo {
  return {
    preserveAudioRequested,
    note: preserveAudioRequested
      ? 'V1 preserves the edit-plan audio intent, but browser-native canvas export may fall back to video-only output when reliable source-audio routing is unavailable.'
      : 'Output is configured as muted/video-only.',
  }
}
