// Minimal stand-in for Node's `crypto` module. bcryptjs imports it to generate
// salts; on React Native we serve secure random bytes from expo-crypto instead.
import * as ExpoCrypto from 'expo-crypto';

export function randomBytes(length) {
  return ExpoCrypto.getRandomBytes(length);
}

export default { randomBytes };
