// Shared mutable state for inject modules — mutate properties, never replace the object.
export const state = {
  fileModelMap: new Map(),
  diffOverlayCleanup: null,
};
