/*
 * Microphone acquisition with clear, actionable errors.
 *
 * getUserMedia fails in several distinct ways that are NOT a permission problem
 * — the device is busy (another tab/app), no device exists, or the page isn't a
 * secure context (`navigator.mediaDevices` is undefined over plain http on a
 * non-localhost origin, which Firefox enforces strictly). A single
 * "check your permissions" catch-all is misleading in all those cases, so we map
 * the failure to a specific message and let the caller surface it.
 */

/** Acquire an audio MediaStream, or throw an Error whose message is safe to show. */
export async function requestMicStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      window.isSecureContext === false
        ? 'Recording needs a secure (https://) connection — open the app over https and try again.'
        : 'This browser doesn’t support microphone recording.',
    );
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    // Keep the raw error in the console for diagnosis; show a mapped message.
    console.error('getUserMedia failed:', err);
    throw new Error(micErrorMessage(err), { cause: err });
  }
}

function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow the microphone for this site in your browser settings.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Connect one or check your system sound settings.';
    case 'NotReadableError':
      return 'The microphone is in use by another app or browser tab. Close it and try again.';
    case 'AbortError':
      return 'Recording was interrupted. Please try again.';
    default:
      return 'Couldn’t start the microphone. Check your browser permissions and try again.';
  }
}
