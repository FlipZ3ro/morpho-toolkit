const colorEnabled = Boolean(process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb');
const ansiPattern = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const oscPattern = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g;

function paint(code: string | number, value: unknown): string {
  const text = String(value);
  return colorEnabled ? `\u001B[${code}m${text}\u001B[0m` : text;
}

export const color = {
  bold: (value: unknown) => paint(1, value),
  dim: (value: unknown) => paint(2, value),
  red: (value: unknown) => paint('38;5;203', value),
  green: (value: unknown) => paint('38;5;82', value),
  yellow: (value: unknown) => paint('38;5;220', value),
  blue: (value: unknown) => paint('38;5;75', value),
  magenta: (value: unknown) => paint('38;5;213', value),
  cyan: (value: unknown) => paint('38;5;45', value),
  white: (value: unknown) => paint('38;5;255', value),
};

function visibleLength(value: string): number {
  return value.replace(oscPattern, '').replace(ansiPattern, '').length;
}

function pad(value: string, width: number, align: 'left' | 'right'): string {
  const missing = Math.max(0, width - visibleLength(value));
  return align === 'right' ? `${' '.repeat(missing)}${value}` : `${value}${' '.repeat(missing)}`;
}

export type TableColumn = {
  title: string;
  align?: 'left' | 'right';
};

export function renderTable(columns: TableColumn[], rows: string[][]): string {
  const widths = columns.map((column, index) => Math.max(
    visibleLength(column.title),
    ...rows.flatMap((row) => (row[index] ?? '').split('\n').map(visibleLength)),
  ));
  const border = (left: string, middle: string, right: string) => color.dim(
    `${left}${widths.map((width) => '─'.repeat(width + 2)).join(middle)}${right}`,
  );
  const row = (values: string[], header = false): string[] => {
    const cells = values.map((value) => value.split('\n'));
    const height = Math.max(...cells.map((cell) => cell.length));
    return Array.from({ length: height }, (_, line) => `${color.dim('│')}${cells.map((cell, index) => {
      const offset = Math.floor((height - cell.length) / 2);
      const value = cell[line - offset] ?? '';
      const rendered = header ? color.bold(color.cyan(value)) : value;
      return ` ${pad(rendered, widths[index], columns[index].align ?? 'left')} `;
    }).join(color.dim('│'))}${color.dim('│')}`);
  };
  return [
    border('┌', '┬', '┐'),
    ...row(columns.map((column) => column.title), true),
    border('├', '┼', '┤'),
    ...rows.flatMap((values) => row(values)),
    border('└', '┴', '┘'),
  ].join('\n');
}

export function centerBlock(value: string, width = process.stdout.columns ?? 80): string {
  return value.split('\n').map((line) => {
    const left = Math.max(0, Math.floor((width - visibleLength(line)) / 2));
    return `${' '.repeat(left)}${line}`;
  }).join('\n');
}

export function joinBlocks(blocks: string[], gap = 4): string {
  const split = blocks.map((block) => block.split('\n'));
  const widths = split.map((lines) => Math.max(...lines.map(visibleLength)));
  const height = Math.max(...split.map((lines) => lines.length));
  return Array.from({ length: height }, (_, row) => split.map((lines, index) => {
    const line = lines[row] ?? '';
    return pad(line, widths[index], 'left');
  }).join(' '.repeat(gap)).trimEnd()).join('\n');
}

export function renderBanner(): string {
  const logo = [
    '███████╗██╗   ██╗███╗   ███╗',
    '██╔════╝██║   ██║████╗ ████║',
    '█████╗  ██║   ██║██╔████╔██║',
    '██╔══╝  ╚██╗ ██╔╝██║╚██╔╝██║',
    '███████╗ ╚████╔╝ ██║ ╚═╝ ██║',
    '╚══════╝  ╚═══╝  ╚═╝     ╚═╝',
  ];
  const palette = ['38;5;45', '38;5;51', '38;5;81', '38;5;117', '38;5;213', '38;5;207'];
  const banner = [
    ...logo.map((line, index) => paint(palette[index], line)),
    '',
    color.bold(color.magenta('E V M  ·  L O A N  ·  T O O L K I T')),
    color.white('Multichain Morpho flashloan CLI'),
    color.dim('BUILT BY ' + color.cyan('0xRapzz')),
    '',
    `${color.cyan('MORPHO')}  ${color.dim('•')}  ${color.green('ZERO-FEE')}  ${color.dim('•')}  ${color.yellow('MULTICHAIN')}`,
    color.dim('─'.repeat(52)),
  ].join('\n');
  return `\n${centerBlock(banner)}\n`;
}

export function promptText(label: string, hint?: string): string {
  const suffix = hint ? ` ${color.dim(hint)}` : '';
  return `${color.magenta('›')} ${color.bold(color.white(label))}${suffix}: `;
}

export function terminalLink(label: string, url: string): string {
  if (!colorEnabled) return url;
  return `\u001B]8;;${url}\u0007${color.cyan(label)}\u001B]8;;\u0007`;
}

export const ui = {
  section: (title: string) => console.log(`\n${color.bold(color.cyan(`== ${title} ==`))}`),
  info: (message: string) => console.log(`${color.blue('[i]')} ${message}`),
  success: (message: string) => console.log(`${color.green('[OK]')} ${message}`),
  warning: (message: string) => console.warn(`${color.yellow('[!]')} ${message}`),
  error: (message: string) => console.error(`${color.red('[ERROR]')} ${message}`),
  plan: (message: string) => console.log(`${color.magenta('[PLAN]')} ${message}`),
};
