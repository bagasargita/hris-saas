import { Injectable } from '@nestjs/common';
import { argon2id, hash, needsRehash, verify } from 'argon2';

/** OWASP Password Storage Cheat Sheet minimum for Argon2id: m=19 MiB, t=2, p=1. */
const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  needsRehash(passwordHash: string): boolean {
    return needsRehash(passwordHash, ARGON2_OPTIONS);
  }

  /** Spends the same work as a real verification so response time does not reveal unknown emails. */
  async verifyAgainstDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-equalization');
    await this.verify(await this.dummyHash, password);
  }
}
