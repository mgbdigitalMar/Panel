// bcryptjs configured for React Native: salts come from expo-crypto's secure RNG.
// Hashes are $2b$10$… and interoperate with the web's bcryptjs.
import bcrypt from 'bcryptjs';
import * as ExpoCrypto from 'expo-crypto';

bcrypt.setRandomFallback((len) => Array.from(ExpoCrypto.getRandomBytes(len)));

export const SALT_ROUNDS = 10;

export function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export default bcrypt;
