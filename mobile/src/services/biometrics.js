// Biometric unlock (fingerprint / face) with expo-local-authentication.
import * as LocalAuthentication from 'expo-local-authentication';

/** { available, label } — label is what the UI calls the method. */
export async function biometricSupport() {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    return {
      available: hasHardware && enrolled,
      label: finger ? 'huella' : face ? 'reconocimiento facial' : 'biometría',
    };
  } catch {
    return { available: false, label: 'biometría' };
  }
}

export async function authenticate(promptMessage = 'Desbloquear Margube') {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
