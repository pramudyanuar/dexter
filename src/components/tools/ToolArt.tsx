import * as React from 'react';

const CELL = '#1d2028';
const LINE = '#2b303b';
const INK = '#e9eaee';
const GREEN = '#56c98a';
const GOLD = '#e4b34a';
const RED = '#e5606a';
const BLUE = '#5b8def';

const move = (to: string) =>
  `transition-transform duration-500 ease-out [transform-box:fill-box] origin-center ${to}`;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox='0 0 160 100'
      className='size-full'
      role='presentation'
      aria-hidden
    >
      {children}
    </svg>
  );
}

function PasteArt() {
  return (
    <Frame>
      {/* Back memo */}
      <rect
        x='30'
        y='24'
        width='68'
        height='58'
        rx='5'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect x='39' y='35' width='36' height='4' rx='2' fill={LINE} />
      <rect x='39' y='44' width='48' height='4' rx='2' fill={LINE} />
      {/* Front synced memo */}
      <g
        className={move(
          'group-hover:translate-x-1.5 group-hover:-translate-y-1',
        )}
      >
        <rect
          x='58'
          y='16'
          width='72'
          height='64'
          rx='5'
          fill='#181b22'
          stroke={GREEN}
          strokeWidth='1.5'
        />
        <rect x='68' y='26' width='34' height='10' rx='3' fill={GREEN} />
        <text
          x='85'
          y='33.5'
          textAnchor='middle'
          fontSize='7'
          fontWeight='700'
          fill='#0f1d16'
        >
          123456
        </text>
        <rect
          x='68'
          y='44'
          width='50'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.85'
        />
        <rect
          x='68'
          y='53'
          width='42'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.5'
        />
        <rect
          x='68'
          y='62'
          width='30'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.35'
        />
      </g>
    </Frame>
  );
}

function QrArt() {
  const finder = (x: number, y: number) => (
    <g>
      <rect x={x} y={y} width='18' height='18' rx='2' fill={INK} />
      <rect x={x + 3} y={y + 3} width='12' height='12' rx='1' fill='#0e1015' />
      <rect x={x + 6} y={y + 6} width='6' height='6' rx='1' fill={INK} />
    </g>
  );

  const dots: [number, number, string?][] = [
    [72, 22],
    [78, 22],
    [72, 28, GOLD],
    [78, 34],
    [52, 46],
    [60, 46, GOLD],
    [70, 46],
    [82, 46],
    [94, 46],
    [58, 54],
    [70, 54],
    [88, 54, GOLD],
    [98, 54],
    [72, 64],
    [82, 64],
    [94, 64],
    [72, 74, GOLD],
    [88, 74],
    [98, 74],
  ];

  return (
    <Frame>
      <rect
        x='44'
        y='14'
        width='72'
        height='72'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      {finder(52, 22)}
      {finder(90, 22)}
      {finder(52, 60)}
      <g className={move('group-hover:scale-105')}>
        {dots.map(([x, y, fill], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width='5'
            height='5'
            rx='1'
            fill={fill ?? INK}
          />
        ))}
      </g>
    </Frame>
  );
}

function DevArt() {
  return (
    <Frame>
      <rect
        x='22'
        y='14'
        width='116'
        height='72'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      {/* Window dots */}
      <circle cx='33' cy='23' r='2.5' fill={RED} />
      <circle cx='42' cy='23' r='2.5' fill={GOLD} />
      <circle cx='51' cy='23' r='2.5' fill={GREEN} />
      <line x1='22' y1='31' x2='138' y2='31' stroke={LINE} strokeWidth='1' />
      {/* Code lines */}
      <g className={move('group-hover:translate-x-1')}>
        <text x='32' y='46' fontSize='11' fontWeight='700' fill={GOLD}>
          {'{'}
        </text>
        <rect x='42' y='39' width='26' height='5' rx='2' fill={BLUE} />
        <rect x='73' y='39' width='42' height='5' rx='2' fill={GREEN} />
        <rect x='42' y='51' width='20' height='5' rx='2' fill={BLUE} />
        <rect
          x='67'
          y='51'
          width='52'
          height='5'
          rx='2'
          fill={INK}
          opacity='0.75'
        />
        <rect x='42' y='63' width='30' height='5' rx='2' fill={BLUE} />
        <rect x='77' y='63' width='28' height='5' rx='2' fill={RED} />
        <text x='32' y='76' fontSize='11' fontWeight='700' fill={GOLD}>
          {'}'}
        </text>
      </g>
    </Frame>
  );
}

function ImageArt() {
  return (
    <Frame>
      {/* Original frame */}
      <rect
        x='24'
        y='18'
        width='68'
        height='52'
        rx='5'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <circle cx='40' cy='32' r='5' fill={GOLD} />
      <polygon
        points='30,62 50,40 66,54 74,46 86,62'
        fill={BLUE}
        opacity='0.8'
      />
      {/* Compressed badge card */}
      <g
        className={move('group-hover:translate-x-1 group-hover:-translate-y-1')}
      >
        <rect
          x='72'
          y='48'
          width='64'
          height='34'
          rx='5'
          fill='#181b22'
          stroke={GREEN}
          strokeWidth='1.5'
        />
        <text
          x='104'
          y='63'
          textAnchor='middle'
          fontSize='9'
          fontWeight='700'
          fill={GREEN}
        >
          WEBP
        </text>
        <text
          x='104'
          y='75'
          textAnchor='middle'
          fontSize='7.5'
          fill={INK}
          opacity='0.8'
        >
          -68% size
        </text>
      </g>
    </Frame>
  );
}

function NotesArt() {
  return (
    <Frame>
      <rect
        x='34'
        y='12'
        width='92'
        height='76'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect x='44' y='23' width='38' height='6' rx='2' fill={GOLD} />
      <line x1='44' y1='35' x2='116' y2='35' stroke={LINE} strokeWidth='1' />
      <g className={move('group-hover:translate-x-1')}>
        <circle cx='47' cy='46' r='2' fill={GREEN} />
        <rect
          x='54'
          y='44'
          width='56'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.85'
        />
        <circle cx='47' cy='58' r='2' fill={GREEN} />
        <rect
          x='54'
          y='56'
          width='44'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.65'
        />
        <rect x='44' y='68' width='68' height='10' rx='3' fill='#14161c' />
        <rect x='49' y='71.5' width='34' height='3' rx='1.5' fill={BLUE} />
      </g>
    </Frame>
  );
}

function AiArt() {
  return (
    <Frame>
      {/* User bubble */}
      <rect
        x='56'
        y='18'
        width='78'
        height='22'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect
        x='66'
        y='27'
        width='56'
        height='4'
        rx='2'
        fill={INK}
        opacity='0.7'
      />
      {/* AI bubble */}
      <g className={move('group-hover:-translate-y-1')}>
        <rect
          x='26'
          y='48'
          width='92'
          height='34'
          rx='6'
          fill='#181b22'
          stroke={BLUE}
          strokeWidth='1.5'
        />
        <polygon
          points='40,56 42,61 47,63 42,65 40,70 38,65 33,63 38,61'
          fill={GOLD}
        />
        <rect
          x='54'
          y='58'
          width='52'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.9'
        />
        <rect
          x='54'
          y='67'
          width='38'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.55'
        />
      </g>
    </Frame>
  );
}

function SendArt() {
  return (
    <Frame>
      {/* Left device */}
      <rect
        x='22'
        y='24'
        width='44'
        height='52'
        rx='5'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect x='30' y='34' width='28' height='22' rx='3' fill='#14161c' />
      {/* Right device */}
      <rect
        x='94'
        y='24'
        width='44'
        height='52'
        rx='5'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect x='102' y='34' width='28' height='22' rx='3' fill='#14161c' />
      {/* Flying file */}
      <g className={move('group-hover:translate-x-2')}>
        <rect x='64' y='38' width='32' height='24' rx='4' fill={BLUE} />
        <polygon points='76,45 86,50 76,55' fill={INK} />
      </g>
    </Frame>
  );
}

function WebArt() {
  return (
    <Frame>
      <rect
        x='22'
        y='16'
        width='116'
        height='68'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect x='30' y='23' width='100' height='11' rx='3' fill='#14161c' />
      <circle cx='37' cy='28.5' r='2.5' fill={GREEN} />
      <rect
        x='44'
        y='26.5'
        width='54'
        height='4'
        rx='2'
        fill={INK}
        opacity='0.6'
      />
      <g className={move('group-hover:scale-105')}>
        <circle
          cx='80'
          cy='58'
          r='16'
          fill='none'
          stroke={BLUE}
          strokeWidth='1.8'
        />
        <ellipse
          cx='80'
          cy='58'
          rx='7'
          ry='16'
          fill='none'
          stroke={BLUE}
          strokeWidth='1.4'
        />
        <line x1='64' y1='58' x2='96' y2='58' stroke={BLUE} strokeWidth='1.4' />
      </g>
    </Frame>
  );
}

function SplitBillArt() {
  return (
    <Frame>
      <rect
        x='38'
        y='14'
        width='84'
        height='72'
        rx='5'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect
        x='48'
        y='24'
        width='36'
        height='5'
        rx='2'
        fill={INK}
        opacity='0.8'
      />
      <rect x='96' y='24' width='16' height='5' rx='2' fill={GREEN} />
      <rect
        x='48'
        y='35'
        width='28'
        height='5'
        rx='2'
        fill={INK}
        opacity='0.5'
      />
      <rect x='92' y='35' width='20' height='5' rx='2' fill={GOLD} />
      <line
        x1='48'
        y1='47'
        x2='112'
        y2='47'
        stroke={LINE}
        strokeDasharray='3 3'
      />
      <g className={move('group-hover:-translate-y-1')}>
        <rect x='48' y='55' width='28' height='20' rx='4' fill={BLUE} />
        <rect x='84' y='55' width='28' height='20' rx='4' fill={GREEN} />
        <text
          x='62'
          y='68'
          textAnchor='middle'
          fontSize='8'
          fontWeight='700'
          fill='#0e1015'
        >
          ÷2
        </text>
        <text
          x='98'
          y='68'
          textAnchor='middle'
          fontSize='8'
          fontWeight='700'
          fill='#0e1015'
        >
          50%
        </text>
      </g>
    </Frame>
  );
}

function PomodoroArt() {
  return (
    <Frame>
      <circle
        cx='80'
        cy='50'
        r='33'
        fill={CELL}
        stroke={LINE}
        strokeWidth='3'
      />
      <circle
        cx='80'
        cy='50'
        r='33'
        fill='none'
        stroke={RED}
        strokeWidth='3'
        strokeDasharray='140 210'
        strokeLinecap='round'
        transform='rotate(-90 80 50)'
      />
      <g className={move('group-hover:scale-105')}>
        <text
          x='80'
          y='54'
          textAnchor='middle'
          fontSize='14'
          fontWeight='700'
          fill={INK}
        >
          25:00
        </text>
      </g>
    </Frame>
  );
}

function PasswordArt() {
  return (
    <Frame>
      <rect
        x='22'
        y='32'
        width='116'
        height='36'
        rx='7'
        fill={CELL}
        stroke={GREEN}
        strokeWidth='1.5'
      />
      <g className={move('group-hover:translate-x-1')}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle
            key={i}
            cx={38 + i * 13}
            cy='50'
            r='3.5'
            fill={i < 4 ? INK : GREEN}
          />
        ))}
        <rect x='114' y='41' width='14' height='18' rx='3' fill={GREEN} />
      </g>
    </Frame>
  );
}

function DiffArt() {
  return (
    <Frame>
      <rect
        x='22'
        y='16'
        width='54'
        height='68'
        rx='5'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect
        x='84'
        y='16'
        width='54'
        height='68'
        rx='5'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect
        x='29'
        y='26'
        width='36'
        height='5'
        rx='2'
        fill={INK}
        opacity='0.5'
      />
      <rect
        x='91'
        y='26'
        width='36'
        height='5'
        rx='2'
        fill={INK}
        opacity='0.5'
      />
      <g className={move('group-hover:-translate-y-0.5')}>
        <rect
          x='27'
          y='38'
          width='44'
          height='12'
          rx='2'
          fill={RED}
          opacity='0.28'
        />
        <rect x='31' y='42' width='30' height='4' rx='2' fill={RED} />
        <rect
          x='89'
          y='38'
          width='44'
          height='12'
          rx='2'
          fill={GREEN}
          opacity='0.28'
        />
        <rect x='93' y='42' width='34' height='4' rx='2' fill={GREEN} />
      </g>
      <rect
        x='29'
        y='58'
        width='40'
        height='5'
        rx='2'
        fill={INK}
        opacity='0.4'
      />
      <rect
        x='91'
        y='58'
        width='40'
        height='5'
        rx='2'
        fill={INK}
        opacity='0.4'
      />
    </Frame>
  );
}

function TextArt() {
  return (
    <Frame>
      <rect
        x='24'
        y='18'
        width='112'
        height='64'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <g className={move('group-hover:translate-x-1')}>
        <text x='36' y='52' fontSize='22' fontWeight='700' fill={GOLD}>
          Aa
        </text>
        <rect
          x='74'
          y='34'
          width='48'
          height='5'
          rx='2'
          fill={INK}
          opacity='0.8'
        />
        <rect x='74' y='45' width='36' height='5' rx='2' fill={BLUE} />
        <rect x='74' y='56' width='42' height='5' rx='2' fill={GREEN} />
      </g>
    </Frame>
  );
}

function ConvertArt() {
  return (
    <Frame>
      <rect
        x='22'
        y='24'
        width='48'
        height='52'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <rect
        x='90'
        y='24'
        width='48'
        height='52'
        rx='6'
        fill={CELL}
        stroke={BLUE}
        strokeWidth='1.5'
      />
      <text
        x='46'
        y='54'
        textAnchor='middle'
        fontSize='12'
        fontWeight='700'
        fill={INK}
      >
        km
      </text>
      <text
        x='114'
        y='54'
        textAnchor='middle'
        fontSize='12'
        fontWeight='700'
        fill={BLUE}
      >
        mi
      </text>
      <g className={move('group-hover:translate-x-1')}>
        <path
          d='M74 44 L86 44 M82 40 L86 44 L82 48'
          stroke={GOLD}
          strokeWidth='2'
          fill='none'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='M86 56 L74 56 M78 52 L74 56 L78 60'
          stroke={GREEN}
          strokeWidth='2'
          fill='none'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </g>
    </Frame>
  );
}

function RegexArt() {
  return (
    <Frame>
      <rect
        x='22'
        y='18'
        width='116'
        height='64'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <text x='34' y='40' fontSize='11' fontWeight='700' fill={GOLD}>
        /[a-z]+/g
      </text>
      <g className={move('group-hover:translate-x-1')}>
        <rect
          x='34'
          y='52'
          width='28'
          height='14'
          rx='3'
          fill={GREEN}
          opacity='0.28'
        />
        <rect x='38' y='57' width='20' height='4' rx='2' fill={GREEN} />
        <rect x='68' y='52' width='18' height='14' rx='3' fill={LINE} />
        <rect
          x='92'
          y='52'
          width='34'
          height='14'
          rx='3'
          fill={GREEN}
          opacity='0.28'
        />
        <rect x='96' y='57' width='26' height='4' rx='2' fill={GREEN} />
      </g>
    </Frame>
  );
}

function JwtArt() {
  return (
    <Frame>
      <rect
        x='20'
        y='24'
        width='120'
        height='52'
        rx='6'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <g className={move('group-hover:-translate-y-0.5')}>
        <rect x='30' y='35' width='26' height='7' rx='2' fill={RED} />
        <circle cx='61' cy='38.5' r='2' fill={INK} />
        <rect x='67' y='35' width='34' height='7' rx='2' fill={BLUE} />
        <circle cx='106' cy='38.5' r='2' fill={INK} />
        <rect x='112' y='35' width='18' height='7' rx='2' fill={GREEN} />
        <rect
          x='30'
          y='52'
          width='64'
          height='5'
          rx='2'
          fill={INK}
          opacity='0.75'
        />
        <rect
          x='30'
          y='61'
          width='44'
          height='5'
          rx='2'
          fill={INK}
          opacity='0.45'
        />
      </g>
    </Frame>
  );
}

function ColorArt() {
  return (
    <Frame>
      <g className={move('group-hover:scale-105')}>
        <circle cx='64' cy='50' r='24' fill={RED} opacity='0.9' />
        <circle cx='96' cy='50' r='24' fill={BLUE} opacity='0.9' />
        <circle cx='80' cy='34' r='20' fill={GOLD} opacity='0.85' />
      </g>
      <rect
        x='44'
        y='70'
        width='72'
        height='16'
        rx='4'
        fill='#181b22'
        stroke={LINE}
        strokeWidth='1.2'
      />
      <text
        x='80'
        y='81'
        textAnchor='middle'
        fontSize='7.5'
        fontWeight='700'
        fill={INK}
      >
        AA 7.2:1
      </text>
    </Frame>
  );
}

function TimerArt() {
  return (
    <Frame>
      <rect
        x='30'
        y='24'
        width='100'
        height='52'
        rx='8'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <g className={move('group-hover:scale-105')}>
        <text
          x='80'
          y='55'
          textAnchor='middle'
          fontSize='16'
          fontWeight='700'
          fill={GREEN}
        >
          00:42.8
        </text>
      </g>
      <rect x='54' y='64' width='52' height='4' rx='2' fill={LINE} />
      <rect x='54' y='64' width='32' height='4' rx='2' fill={GOLD} />
    </Frame>
  );
}

function PdfArt() {
  return (
    <Frame>
      {/* Back image */}
      <rect
        x='28'
        y='22'
        width='50'
        height='58'
        rx='4'
        fill={CELL}
        stroke={LINE}
        strokeWidth='1.5'
      />
      <circle cx='42' cy='36' r='4' fill={GOLD} />
      <polygon points='34,64 48,46 60,56 72,64' fill={BLUE} opacity='0.75' />
      {/* Front PDF */}
      <g
        className={move(
          'group-hover:translate-x-1.5 group-hover:-translate-y-1',
        )}
      >
        <rect
          x='68'
          y='16'
          width='62'
          height='68'
          rx='5'
          fill='#181b22'
          stroke={RED}
          strokeWidth='1.5'
        />
        <rect x='78' y='26' width='32' height='12' rx='3' fill={RED} />
        <text
          x='94'
          y='35'
          textAnchor='middle'
          fontSize='7.5'
          fontWeight='700'
          fill={INK}
        >
          PDF
        </text>
        <rect
          x='78'
          y='46'
          width='42'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.75'
        />
        <rect
          x='78'
          y='55'
          width='34'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.5'
        />
        <rect
          x='78'
          y='64'
          width='26'
          height='4'
          rx='2'
          fill={INK}
          opacity='0.35'
        />
      </g>
    </Frame>
  );
}

const ART: Record<string, () => React.ReactNode> = {
  paste: PasteArt,
  qr: QrArt,
  'split-bill': SplitBillArt,
  pomodoro: PomodoroArt,
  password: PasswordArt,
  diff: DiffArt,
  text: TextArt,
  convert: ConvertArt,
  regex: RegexArt,
  jwt: JwtArt,
  color: ColorArt,
  timer: TimerArt,
  dev: DevArt,
  image: ImageArt,
  pdf: PdfArt,
  notes: NotesArt,
  ai: AiArt,
  send: SendArt,
  web: WebArt,
};

export default function ToolArt({ id }: { id: string }) {
  const Draw = ART[id];
  return Draw ? <Draw /> : null;
}
