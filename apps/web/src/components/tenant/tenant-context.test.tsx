import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TenantContextResponse } from '@saas/contracts';
import { Can, TenantProvider, useTenant } from './tenant-context';

const context: TenantContextResponse = {
  tenant: {
    id: 't1',
    name: 'Acme',
    slug: 'acme',
    status: 'ACTIVE',
    plan: 'PRO',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  membershipId: 'm1',
  roles: [{ id: 'r1', key: 'manager', name: 'Manager' }],
  permissions: ['tenant.read', 'members.read', 'members.invite'],
};

function BasePath() {
  return <span>{useTenant().basePath}</span>;
}

describe('TenantProvider / Can', () => {
  it('renders gated content only for permissions present in the server-provided context', () => {
    render(
      <TenantProvider context={context}>
        <Can permission="members.invite">
          <button>Invite</button>
        </Can>
        <Can permission="roles.delete" fallback={<span>no delete</span>}>
          <button>Delete role</button>
        </Can>
        <BasePath />
      </TenantProvider>,
    );
    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete role' })).not.toBeInTheDocument();
    expect(screen.getByText('no delete')).toBeInTheDocument();
    expect(screen.getByText('/t/acme')).toBeInTheDocument();
  });

  it('throws when used outside a tenant route', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BasePath />)).toThrow(/inside a tenant route/);
    spy.mockRestore();
  });
});
