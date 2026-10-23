import { ALL_PERMISSIONS, DEFAULT_TENANT_ROLES, type PermissionKey } from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import {
  type ActorScope,
  assertCanAssignRole,
  assertCanEditRole,
  assertCanGrantPermissions,
  assertCanManageMember,
  permissionsOutsideScope,
} from './authorization.policy';

function rolePermissions(key: string): readonly PermissionKey[] {
  const role = DEFAULT_TENANT_ROLES.find((r) => r.key === key);
  if (!role) throw new Error(`unknown role ${key}`);
  return role.permissions;
}

function actor(roleKey: string, membershipId = 'actor'): ActorScope {
  return {
    membershipId,
    isOwner: roleKey === 'owner',
    permissions: new Set(rolePermissions(roleKey)),
  };
}

function member(roleKey: string, membershipId = 'target') {
  return {
    membershipId,
    isOwner: roleKey === 'owner',
    permissions: new Set<string>(rolePermissions(roleKey)),
  };
}

function errorCode(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error instanceof AppException ? error.code : 'UNEXPECTED';
  }
}

describe('authorization policy', () => {
  describe('permissionsOutsideScope', () => {
    it('returns sorted, de-duplicated permissions missing from the scope', () => {
      expect(permissionsOutsideScope(['b', 'a', 'b', 'c'], new Set(['c']))).toEqual(['a', 'b']);
    });
  });

  describe('assertCanGrantPermissions', () => {
    it('allows granting a subset of own permissions', () => {
      expect(
        errorCode(() =>
          assertCanGrantPermissions(actor('admin'), ['members.read', 'roles.update']),
        ),
      ).toBeUndefined();
    });

    it('rejects granting a permission the actor lacks', () => {
      expect(errorCode(() => assertCanGrantPermissions(actor('admin'), ['billing.manage']))).toBe(
        'PRIVILEGE_ESCALATION',
      );
    });

    it('lets owners grant every permission', () => {
      expect(
        errorCode(() => assertCanGrantPermissions(actor('owner'), ALL_PERMISSIONS)),
      ).toBeUndefined();
    });
  });

  describe('assertCanAssignRole', () => {
    it('lets an admin assign the member role', () => {
      expect(
        errorCode(() =>
          assertCanAssignRole(actor('admin'), {
            key: 'member',
            permissions: rolePermissions('member'),
          }),
        ),
      ).toBeUndefined();
    });

    it('prevents a manager from assigning admin', () => {
      expect(
        errorCode(() =>
          assertCanAssignRole(actor('manager'), {
            key: 'admin',
            permissions: rolePermissions('admin'),
          }),
        ),
      ).toBe('PRIVILEGE_ESCALATION');
    });

    it('reserves the owner role for owners even if the actor holds every permission', () => {
      const superAdminLike: ActorScope = {
        membershipId: 'x',
        isOwner: false,
        permissions: new Set(ALL_PERMISSIONS),
      };
      expect(
        errorCode(() =>
          assertCanAssignRole(superAdminLike, { key: 'owner', permissions: ALL_PERMISSIONS }),
        ),
      ).toBe('PRIVILEGE_ESCALATION');
    });
  });

  describe('assertCanManageMember', () => {
    it('lets an admin manage a member', () => {
      expect(
        errorCode(() => assertCanManageMember(actor('admin'), member('member'))),
      ).toBeUndefined();
    });

    it('prevents managing yourself', () => {
      expect(
        errorCode(() => assertCanManageMember(actor('owner', 'same'), member('member', 'same'))),
      ).toBe('FORBIDDEN');
    });

    it('prevents an admin from managing an owner', () => {
      expect(errorCode(() => assertCanManageMember(actor('admin'), member('owner')))).toBe(
        'PRIVILEGE_ESCALATION',
      );
    });

    it('prevents a manager from managing an admin', () => {
      expect(errorCode(() => assertCanManageMember(actor('manager'), member('admin')))).toBe(
        'PRIVILEGE_ESCALATION',
      );
    });
  });

  describe('assertCanEditRole', () => {
    it('never allows editing the owner role', () => {
      expect(
        errorCode(() =>
          assertCanEditRole(actor('owner'), { key: 'owner', permissions: ALL_PERMISSIONS }),
        ),
      ).toBe('FORBIDDEN');
    });

    it('rejects adding permissions beyond the actor scope', () => {
      expect(
        errorCode(() =>
          assertCanEditRole(
            actor('admin'),
            { key: 'member', permissions: rolePermissions('member') },
            ['billing.manage'],
          ),
        ),
      ).toBe('PRIVILEGE_ESCALATION');
    });

    it('rejects editing a role that already exceeds the actor scope', () => {
      expect(
        errorCode(() =>
          assertCanEditRole(
            actor('manager'),
            { key: 'admin', permissions: rolePermissions('admin') },
            ['tenant.read'],
          ),
        ),
      ).toBe('PRIVILEGE_ESCALATION');
    });
  });
});
