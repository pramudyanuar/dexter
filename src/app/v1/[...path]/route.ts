import { createRelay } from '@/features/relay/handler';

export const dynamic = 'force-dynamic';

const relay = createRelay();

export function GET(request: Request) {
  return relay(request);
}

export function HEAD(request: Request) {
  return relay(request);
}

export function POST(request: Request) {
  return relay(request);
}

export function DELETE(request: Request) {
  return relay(request);
}
