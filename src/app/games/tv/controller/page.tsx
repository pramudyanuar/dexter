import type { Metadata } from 'next';

import PhoneController from '@/features/tv-controller/PhoneController';

export const metadata: Metadata = {
  title: 'Controller HP · Turbo TV Arena',
  description: 'Gunakan HP kamu sebagai gamepad untuk bermain di layar TV.',
};

export default function TvControllerPage() {
  return <PhoneController />;
}
