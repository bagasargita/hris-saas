'use client';

import { LogOutIcon, ShieldIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { UserDto } from '@saas/contracts';
import { Avatar, AvatarFallback } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/lib/api/hooks';
import { initials } from '@/lib/utils';

export function UserMenu({ user }: { user: Pick<UserDto, 'name' | 'email' | 'platformRole'> }) {
  const router = useRouter();
  const logout = useLogout();

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        router.replace('/login');
        router.refresh();
      },
      onError: () =>
        toast.error('Keluar tidak berhasil sepenuhnya. Sesi Anda telah dihapus secara lokal.'),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2" aria-label="Menu akun">
          <Avatar className="size-7">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm md:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserIcon /> Pengaturan akun
          </Link>
        </DropdownMenuItem>
        {user.platformRole === 'SUPER_ADMIN' && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldIcon /> Admin platform
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onLogout} disabled={logout.isPending}>
          <LogOutIcon /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
