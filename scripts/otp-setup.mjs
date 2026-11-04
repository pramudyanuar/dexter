// Creates the TOTP secret for the chat login and shows a QR code to scan with
// an authenticator app (Google Authenticator, Authy, 1Password, Aegis, ...).
//
//   pnpm otp:setup         show the QR for the secret in .env (creates it first time)
//   pnpm otp:setup --new   replace the secret (logs out every session)
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

import qrcode from 'qrcode-terminal';

const ENV_FILE = '.env';
const KEY = 'CHAT_TOTP_SECRET';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(buf) {
  const bits = [...buf].map((b) => b.toString(2).padStart(8, '0')).join('');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  }
  return out;
}

const env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
const line = new RegExp(`^${KEY}=.*$`, 'm');
const existing = env.match(
  new RegExp(`^${KEY}="?([A-Z2-7]+)"?\\s*$`, 'm'),
)?.[1];

let secret = existing;
if (!secret || process.argv.includes('--new')) {
  secret = base32(randomBytes(20));
  const entry = `${KEY}="${secret}"`;
  const next = line.test(env)
    ? env.replace(line, entry)
    : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${entry}\n`;
  fs.writeFileSync(ENV_FILE, next);
  console.log(`Secret baru ditulis ke ${ENV_FILE}\n`);
} else {
  console.log(`Memakai secret yang sudah ada di ${ENV_FILE}\n`);
}

const uri = `otpauth://totp/dexter:chat?secret=${secret}&issuer=dexter`;
qrcode.generate(uri, { small: true });

console.log(`
Scan QR di atas dengan aplikasi authenticator, atau tambahkan manual:
  Setup key : ${secret}
  Tipe      : berbasis waktu (TOTP), 6 digit, 30 detik

Untuk Vercel, set env var yang sama:
  ${KEY}=${secret}

Lalu restart dev server dan login dengan kode 6 digit dari aplikasi.
`);
