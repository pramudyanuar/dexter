'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import Practice from './Practice';

const Party = dynamic(() => import('./Party'), { ssr: false });

export default function Game() {
  const [party, setParty] = useState(false);
  return party ? (
    <Party onBack={() => setParty(false)} />
  ) : (
    <Practice onParty={() => setParty(true)} />
  );
}
