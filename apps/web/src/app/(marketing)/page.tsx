import {
  ArrowRightIcon,
  Building2Icon,
  KeyRoundIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Building2Icon,
    title: 'Dirancang untuk multi-workspace',
    text: 'Setiap tim mendapat workspace terisolasi. Pengguna dapat tergabung di banyak workspace dan beralih dengan cepat.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Peran yang terperinci',
    text: 'Owner, admin, manager, member, dan viewer siap pakai, plus peran kustom dari izin eksplisit.',
  },
  {
    icon: UsersIcon,
    title: 'Undangan yang mudah',
    text: 'Undang lewat email dengan peran yang sudah ditetapkan. Tautan sekali pakai, kedaluwarsa otomatis, dan dapat dicabut.',
  },
  {
    icon: ScrollTextIcon,
    title: 'Jejak audit lengkap',
    text: 'Masuk, perubahan peran, undangan, dan pengaturan dicatat dengan pelaku, waktu, dan asal.',
  },
  {
    icon: KeyRoundIcon,
    title: 'Kontrol sesi',
    text: 'Lihat setiap perangkat yang masuk ke akun Anda dan cabut aksesnya dengan satu klik.',
  },
  {
    icon: ZapIcon,
    title: 'Cepat di mana saja',
    text: 'Halaman di-render di server, kueri di-cache, dan antarmuka responsif untuk desktop dan mobile.',
  },
];

const SECURITY = [
  'Kata sandi di-hash dengan Argon2id',
  'Cookie sesi HttpOnly, SameSite dengan pencabutan di sisi server',
  'Perlindungan CSRF pada setiap permintaan yang mengubah state',
  'Akses tenant diverifikasi di server untuk setiap permintaan',
  'Pencegahan eskalasi hak istimewa untuk perubahan peran dan undangan',
  'Endpoint autentikasi dengan batas laju permintaan',
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 py-24 text-center md:px-6 md:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-3.5 text-primary" /> Dibangun untuk tim multi-tenant
            yang aman
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Platform workspace yang tim keamanan Anda setujui
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
            Workspace, anggota, peran, undangan, dan log audit — dengan isolasi tenant dan kontrol
            akses yang ditegakkan di server, bukan hanya disembunyikan di UI.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Mulai gratis <ArrowRightIcon />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">Lihat harga</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Semua yang produk B2B butuhkan sejak hari pertama
          </h2>
          <p className="mt-3 text-muted-foreground">
            Fokus pada produk Anda. Akun, workspace, dan izin sudah tersedia.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="gap-3">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-4.5" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.text}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="security" className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:px-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Keamanan bawaan, bukan fitur tambahan
            </h2>
            <p className="mt-3 text-muted-foreground">
              Peramban tidak menentukan siapa boleh melihat apa. Setiap permintaan diautentikasi dan
              diotorisasi oleh API berdasarkan keanggotaan dan peran Anda yang sebenarnya.
            </p>
          </div>
          <ul className="grid gap-3">
            {SECURITY.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 text-sm"
              >
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">Siap mengajak tim Anda?</h2>
        <p className="mt-3 text-muted-foreground">
          Buat workspace dalam kurang dari satu menit. Tanpa kartu kredit.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link href="/register">Buat workspace Anda</Link>
        </Button>
      </section>
    </>
  );
}
