// Minimal stand-in for Node's `crypto` module: secure random bytes from expo-crypto.
import * as ExpoCrypto from 'expo-crypto';

export function randomBytes(length) {
  return ExpoCrypto.getRandomBytes(length);
}

export default { randomBytes };
