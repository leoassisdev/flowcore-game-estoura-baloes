// EstouraBaloes · Criado por FlowCore Soluções LTDA · flowcoresolucoes.com.br/codigos · licença MIT
// Atire bolhas coloridas, junte 3 ou mais da mesma cor e derrube os cachos soltos.
// Controles: mova o mouse ou o dedo sobre o tabuleiro para mirar e clique/solte
// para atirar · setas esquerda/direita giram a mira · Espaço atira (e começa) ·
// C ou toque na próxima bolha troca · P pausa · no celular, botões na tela.
// Props:
//   tema?: "claro" | "escuro"   tema inicial (padrão "claro"); o botão sol/lua do HUD alterna
//   onTemaChange?: (tema) => void   avisa quando o jogador troca o tema
//   accent?: string            cor de destaque (padrão "#0057FF")
//   variacao?: "Clássico" | "Turbo" | "Caos"   preset inicial
//   cores?: number             quantidade de cores no nível 1 (3 a 6)
//   tirosParaDescer?: number   a cada N tiros o teto desce uma fileira
//   velocidadeTiro?: number    velocidade da bolha disparada (px/s virtuais)
//   obstaculosExtras?: number  bolhas de pedra indestrutíveis por nível
//   tipoTiro?: "simples" | "bomba"   "bomba" = de vez em quando vem uma bomba
// O seletor "Variações" troca o preset ao vivo. Recorde salvo no localStorage.
// Requisitos: React 18+ e Tailwind CSS 3+. Zero dependências.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

/* ----------------------------- lógica pura ----------------------------- */

type Grade = (number | null)[][];

function vizP(linha: number, coluna: number, colunas: number, linhas: number, par: number): [number, number][] {
  const deslocada = ((linha + par) & 1) === 1;
  const d = deslocada
    ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
    : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  const out: [number, number][] = [];
  for (const [dl, dc] of d) {
    const l = linha + dl;
    const c = coluna + dc;
    if (l >= 0 && l < linhas && c >= 0 && c < colunas) out.push([l, c]);
  }
  return out;
}

/** Vizinhos de uma casa na grade hexagonal (linhas ímpares deslocadas meia bolha à direita). */
export function vizinhosHex(linha: number, coluna: number, colunas: number, linhas: number): [number, number][] {
  return vizP(linha, coluna, colunas, linhas, 0);
}

function grupoP(grade: Grade, linha: number, coluna: number, par: number): [number, number][] {
  const alvo = grade[linha]?.[coluna];
  if (alvo === null || alvo === undefined) return [];
  const linhas = grade.length;
  const colunas = grade[0]?.length ?? 0;
  const visto = new Set<number>([linha * colunas + coluna]);
  const fila: [number, number][] = [[linha, coluna]];
  const out: [number, number][] = [];
  while (fila.length) {
    const [l, c] = fila.shift() as [number, number];
    out.push([l, c]);
    for (const [vl, vc] of vizP(l, c, colunas, linhas, par)) {
      const k = vl * colunas + vc;
      if (!visto.has(k) && grade[vl][vc] === alvo) {
        visto.add(k);
        fila.push([vl, vc]);
      }
    }
  }
  return out;
}

/** BFS das casas conectadas com a mesma cor da casa inicial (inclui a inicial). */
export function grupoMesmaCor(grade: (number | null)[][], linha: number, coluna: number): [number, number][] {
  return grupoP(grade, linha, coluna, 0);
}

function soltosP(grade: Grade, par: number): [number, number][] {
  const linhas = grade.length;
  const colunas = grade[0]?.length ?? 0;
  const visto = new Set<number>();
  const fila: [number, number][] = [];
  for (let c = 0; c < colunas; c++) {
    if (grade[0][c] !== null && grade[0][c] !== undefined) {
      visto.add(c);
      fila.push([0, c]);
    }
  }
  while (fila.length) {
    const [l, c] = fila.shift() as [number, number];
    for (const [vl, vc] of vizP(l, c, colunas, linhas, par)) {
      const k = vl * colunas + vc;
      const v = grade[vl][vc];
      if (!visto.has(k) && v !== null && v !== undefined) {
        visto.add(k);
        fila.push([vl, vc]);
      }
    }
  }
  const out: [number, number][] = [];
  for (let l = 0; l < linhas; l++)
    for (let c = 0; c < colunas; c++) {
      const v = grade[l][c];
      if (v !== null && v !== undefined && !visto.has(l * colunas + c)) out.push([l, c]);
    }
  return out;
}

/** Casas ocupadas que não estão ligadas (por vizinhança) à linha 0, o teto. */
export function soltos(grade: (number | null)[][]): [number, number][] {
  return soltosP(grade, 0);
}

/* ------------------------------ variações ------------------------------ */

type NomeVariacao = "Clássico" | "Turbo" | "Caos";
type TipoTiro = "simples" | "bomba";
type Config = {
  cores: number;
  tirosParaDescer: number;
  velocidadeTiro: number;
  obstaculosExtras: number;
  tipoTiro: TipoTiro;
  modoTeto: "desce" | "empurra";
};

const VARIACOES: Record<NomeVariacao, Config> = {
  Clássico: { cores: 4, tirosParaDescer: 8, velocidadeTiro: 900, obstaculosExtras: 0, tipoTiro: "simples", modoTeto: "desce" },
  Turbo: { cores: 5, tirosParaDescer: 6, velocidadeTiro: 1350, obstaculosExtras: 0, tipoTiro: "bomba", modoTeto: "empurra" },
  Caos: { cores: 6, tirosParaDescer: 5, velocidadeTiro: 1100, obstaculosExtras: 6, tipoTiro: "bomba", modoTeto: "empurra" },
};

/* --------------------------------- tema --------------------------------- */

export type Tema = "claro" | "escuro";
// Paleta do tema: vira CSS vars na raiz (classes) e é lida pelo canvas.
const TEMAS: Record<Tema, Record<string, string>> = {
  claro: {
    "--fc-bg": "#F7F8FB", "--fc-surface": "#FFFFFF", "--fc-surface-2": "#F1F4F9",
    "--fc-border": "#E3E8F0", "--fc-border-strong": "#CBD3E1",
    "--fc-text": "#0B1220", "--fc-muted": "#4B5565", "--fc-subtle": "#8A94A6",
    "--fc-pos": "#059669", "--fc-neg": "#E11D48", "--fc-warn": "#D97706",
    "--fc-shadow": "0 1px 2px rgba(16,24,40,.06), 0 12px 32px -16px rgba(16,24,40,.18)",
  },
  escuro: {
    "--fc-bg": "#0B0F17", "--fc-surface": "rgba(255,255,255,0.03)", "--fc-surface-2": "rgba(255,255,255,0.06)",
    "--fc-border": "rgba(255,255,255,0.10)", "--fc-border-strong": "rgba(255,255,255,0.25)",
    "--fc-text": "#FFFFFF", "--fc-muted": "rgba(255,255,255,0.60)", "--fc-subtle": "rgba(255,255,255,0.40)",
    "--fc-pos": "#34D399", "--fc-neg": "#FB7185", "--fc-warn": "#FBBF24",
    "--fc-shadow": "0 24px 48px -24px rgba(0,0,0,.6)",
  },
};

function BotaoTema({ tema, onClick }: { tema: Tema; onClick: () => void }) {
  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] transition-colors hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        {escuro ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        )}
      </svg>
    </button>
  );
}

type Props = {
  tema?: Tema;
  onTemaChange?: (tema: Tema) => void;
  accent?: string;
  variacao?: NomeVariacao;
  cores?: number;
  tirosParaDescer?: number;
  velocidadeTiro?: number;
  obstaculosExtras?: number;
  tipoTiro?: TipoTiro;
};

type Status = "inicio" | "jogando" | "pausado" | "fim";

/* ------------------------------ constantes ----------------------------- */

const COLS = 11;
const LINHAS = 16;
const R = 20;
const D = R * 2;
const ROWH = R * Math.sqrt(3);
const W = COLS * D + R; // 460
const H = 640;
const TOPO = 10;
const LINHA_MORTE = 540;
const LX = W / 2;
const LY = 596;
const PX = LX - 86;
const PY = LY + 16;
const PEDRA = 6;
const BOMBA = 7;
const DT = 1 / 120;

const PALETA = [
  { base: "#FF4D6D", claro: "#FFC2CF", escuro: "#9E1230" },
  { base: "#FFC23D", claro: "#FFF2C2", escuro: "#A86F00" },
  { base: "#2BD67B", claro: "#C2F8DA", escuro: "#0B7340" },
  { base: "#3DA5FF", claro: "#CCE8FF", escuro: "#0B55A0" },
  { base: "#B266FF", claro: "#EAD6FF", escuro: "#5A1EA3" },
  { base: "#FF8A3D", claro: "#FFDCC2", escuro: "#A3470B" },
];

type Bola = { x: number; y: number; vx: number; vy: number; cor: number };
type Particula = { x: number; y: number; vx: number; vy: number; vida: number; max: number; cor: string; r: number };
type Caindo = { x: number; y: number; vx: number; vy: number; cor: number };
type Estouro = { x: number; y: number; cor: number; t: number };
type Texto = { x: number; y: number; txt: string; t: number };

type Estado = {
  grade: Grade;
  par: number;
  descidas: number;
  teto: number;
  tetoVis: number;
  cores: number;
  tiros: number;
  atual: number;
  prox: number;
  contBomba: number;
  bola: Bola | null;
  angulo: number;
  girar: number;
  parts: Particula[];
  caindo: Caindo[];
  estouros: Estouro[];
  textos: Texto[];
  pontos: number;
  nivel: number;
  acc: number;
  tremor: number;
  recuo: number;
};

/** Paleta de desenho do canvas por tema (escuro = visual original). */
type Paleta = {
  fundo: [string, string]; pontos: string; teto: [string, string]; tetoListra: string; tetoBlur: number;
  baseLanc: string; canoLanc: string; lancBlur: number; lancFundo: string; lancBorda: string;
  proxFundo: string; rotulo: string; rotulo2: string; bolaSombra: string; texto: string;
  contorno: number; bombaBlur: number;
};

const CORES: Record<Tema, Paleta> = {
  escuro: {
    fundo: ["#111a2b", "#0a0e17"], pontos: "rgba(255,255,255,0.035)", teto: ["#1a2233", "#2a3448"],
    tetoListra: "rgba(255,255,255,0.05)", tetoBlur: 10,
    baseLanc: "rgba(255,255,255,0.08)", canoLanc: "#2a3448", lancBlur: 8, lancFundo: "#1a2233", lancBorda: "rgba(255,255,255,0.12)",
    proxFundo: "rgba(255,255,255,0.05)", rotulo: "rgba(255,255,255,0.4)", rotulo2: "rgba(255,255,255,0.3)",
    bolaSombra: "rgba(255,255,255,0.4)", texto: "#fff", contorno: 0, bombaBlur: 10,
  },
  claro: {
    fundo: ["#FBFCFF", "#EAF0F8"], pontos: "rgba(15,23,42,0.07)", teto: ["#E3E8F2", "#CBD3E1"],
    tetoListra: "rgba(255,255,255,0.55)", tetoBlur: 0,
    baseLanc: "rgba(15,23,42,0.06)", canoLanc: "#64748B", lancBlur: 0, lancFundo: "#FFFFFF", lancBorda: "#CBD3E1",
    proxFundo: "rgba(15,23,42,0.05)", rotulo: "#4B5565", rotulo2: "#8A94A6",
    bolaSombra: "rgba(15,23,42,0.25)", texto: "#0B1220", contorno: 0.4, bombaBlur: 6,
  },
};

const CHAVE = "flowcore-estoura-baloes-recorde";
const LINK = "https://flowcoresolucoes.com.br/codigos";

function lerRecorde(): number {
  try {
    return Number(localStorage.getItem(CHAVE)) || 0;
  } catch {
    return 0;
  }
}

function salvarRecorde(v: number) {
  try {
    localStorage.setItem(CHAVE, String(v));
  } catch {
    /* localStorage indisponível (modo privado, iframe sandbox) */
  }
}

function deslocada(linha: number, par: number) {
  return ((linha + par) & 1) === 1;
}

function posX(linha: number, coluna: number, par: number) {
  return R + coluna * D + (deslocada(linha, par) ? R : 0);
}

function posY(linha: number, teto: number) {
  return teto + R + linha * ROWH;
}

function coresPresentes(g: Grade): number[] {
  const s = new Set<number>();
  for (const linha of g) for (const v of linha) if (v !== null && v < PEDRA) s.add(v);
  return [...s];
}

function montarGrade(cores: number, nivel: number, pedras: number): Grade {
  const g: Grade = Array.from({ length: LINHAS }, () => Array<number | null>(COLS).fill(null));
  const filas = Math.min(9, 5 + nivel - 1);
  for (let l = 0; l < filas; l++)
    for (let c = 0; c < COLS; c++) {
      const r = Math.random();
      // Copia a cor de um vizinho às vezes para formar cachos jogáveis.
      if (c > 0 && r < 0.35) g[l][c] = g[l][c - 1];
      else if (l > 0 && r < 0.55) g[l][c] = g[l - 1][c];
      else g[l][c] = Math.floor(Math.random() * cores);
    }
  let colocadas = 0;
  let tentativas = 0;
  while (colocadas < pedras && tentativas < 200) {
    tentativas++;
    const l = 1 + Math.floor(Math.random() * (filas - 1));
    const c = Math.floor(Math.random() * COLS);
    if (g[l][c] !== PEDRA) {
      g[l][c] = PEDRA;
      colocadas++;
    }
  }
  return g;
}

function sortearCor(e: Estado, cfg: Config): number {
  if (cfg.tipoTiro === "bomba") {
    e.contBomba++;
    if (e.contBomba >= 9) {
      e.contBomba = 0;
      return BOMBA;
    }
  }
  const pres = coresPresentes(e.grade);
  if (!pres.length) return Math.floor(Math.random() * e.cores);
  return pres[Math.floor(Math.random() * pres.length)];
}

function novoEstado(cfg: Config): Estado {
  const cores = Math.max(3, Math.min(6, Math.round(cfg.cores)));
  const e: Estado = {
    grade: montarGrade(cores, 1, cfg.obstaculosExtras),
    par: 0,
    descidas: 0,
    teto: TOPO,
    tetoVis: TOPO,
    cores,
    tiros: 0,
    atual: 0,
    prox: 0,
    contBomba: 0,
    bola: null,
    angulo: -Math.PI / 2,
    girar: 0,
    parts: [],
    caindo: [],
    estouros: [],
    textos: [],
    pontos: 0,
    nivel: 1,
    acc: 0,
    tremor: 0,
    recuo: 0,
  };
  e.atual = sortearCor(e, cfg);
  e.prox = sortearCor(e, cfg);
  return e;
}

function colideGrade(e: Estado, x: number, y: number, raio: number): boolean {
  if (y - R <= e.teto) return true;
  const lim = raio * raio;
  for (let l = 0; l < LINHAS; l++) {
    const cy = posY(l, e.teto);
    if (Math.abs(cy - y) > D) continue;
    for (let c = 0; c < COLS; c++) {
      if (e.grade[l][c] === null) continue;
      const dx = posX(l, c, e.par) - x;
      const dy = cy - y;
      if (dx * dx + dy * dy < lim) return true;
    }
  }
  return false;
}

/** Trajetória prevista da mira: até uma batida na parede. */
function tracarMira(e: Estado): { pts: [number, number][]; fim: [number, number] } {
  let x = LX;
  let y = LY;
  let vx = Math.cos(e.angulo);
  const vy = Math.sin(e.angulo);
  const pts: [number, number][] = [];
  let batidas = 0;
  for (let i = 0; i < 260; i++) {
    x += vx * 4;
    y += vy * 4;
    if (x < R || x > W - R) {
      if (batidas >= 1) break;
      batidas++;
      x = x < R ? 2 * R - x : 2 * (W - R) - x;
      vx = -vx;
    }
    if (i % 4 === 0) pts.push([x, y]);
    if (colideGrade(e, x, y, D * 0.86)) break;
  }
  return { pts, fim: [x, y] };
}

function explodir(e: Estado, x: number, y: number, cor: number, n: number) {
  const c = cor === PEDRA ? "#9AA3B2" : cor === BOMBA ? "#FFB23D" : PALETA[cor].base;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 60 + Math.random() * 220;
    const max = 0.35 + Math.random() * 0.4;
    e.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: max, max, cor: c, r: 1.5 + Math.random() * 2.5 });
  }
}

function passouLinha(e: Estado) {
  for (let l = LINHAS - 1; l >= 0; l--)
    for (let c = 0; c < COLS; c++) if (e.grade[l][c] !== null && posY(l, e.teto) + R > LINHA_MORTE) return true;
  return false;
}

/* ------------------------------ componente ----------------------------- */

/* ------------------------------ como jogar ------------------------------ */

// Teclas mostradas na tela inicial e na pausa ("ou" vira separador).
const TECLAS: [string[], string][] = [
  [["Mouse"], "mirar"],
  [["Clique", "ou", "Espaço"], "atirar"],
  [["←", "→"], "girar a mira"],
  [["C"], "trocar a bolha"],
  [["P"], "pausar"],
];
// Versão de toque, mostrada no celular (abaixo do jogo, onde sempre cabe).
const TOQUE = [
  "Arraste o dedo no tabuleiro para mirar e solte para atirar",
  "Toque na próxima bolha para trocar",
  "ou use os botões abaixo do jogo",
];
const RESUMO_TECLADO = "Mouse mira · clique ou Espaço atira · ← → giram a mira · C troca · P pausa";
const RESUMO_TOQUE = "Arraste para mirar e solte para atirar";

function ComoJogar({ className = "" }: { className?: string }) {
  return (
    <div className={`w-fit max-w-full text-xs text-[var(--fc-muted)] ${className}`}>
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fc-subtle)]">Como jogar</p>
      <div className="hidden grid-cols-[auto_auto] items-center gap-x-3 gap-y-1.5 sm:grid">
        {TECLAS.map(([teclas, acao]) => (
          <div key={acao} className="contents">
            <span className="flex flex-wrap items-center justify-end gap-1">
              {teclas.map((t, i) =>
                t === "ou" ? (
                  <span key={i} className="text-[10px] text-[var(--fc-subtle)]">
                    ou
                  </span>
                ) : (
                  <kbd key={i} className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--fc-text)]">
                    {t}
                  </kbd>
                ),
              )}
            </span>
            <span className="text-left">{acao}</span>
          </div>
        ))}
      </div>
      <ul className="space-y-1 text-center sm:hidden">
        {TOQUE.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default function EstouraBaloes({
  accent = "#0057FF",
  tema = "claro",
  onTemaChange,
  variacao = "Clássico",
  cores,
  tirosParaDescer,
  velocidadeTiro,
  obstaculosExtras,
  tipoTiro,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [temaAtual, setTemaAtual] = useState<Tema>(tema);
  useEffect(() => setTemaAtual(tema), [tema]);
  const temaRef = useRef<Tema>(tema);
  temaRef.current = temaAtual;
  const alternarTema = () => {
    const novo: Tema = temaAtual === "claro" ? "escuro" : "claro";
    setTemaAtual(novo);
    onTemaChange?.(novo);
    rootRef.current?.focus();
  };
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const inicial: Config = {
    ...VARIACOES[variacao],
    ...(cores !== undefined && { cores }),
    ...(tirosParaDescer !== undefined && { tirosParaDescer }),
    ...(velocidadeTiro !== undefined && { velocidadeTiro }),
    ...(obstaculosExtras !== undefined && { obstaculosExtras }),
    ...(tipoTiro !== undefined && { tipoTiro }),
  };

  const [nomeVar, setNomeVar] = useState<NomeVariacao>(variacao);
  const [cfg, setCfg] = useState<Config>(inicial);
  const [status, setStatus] = useState<Status>("inicio");
  const [hud, setHud] = useState({ pontos: 0, nivel: 1 });
  const [recorde, setRecorde] = useState(0);
  const [largura, setLargura] = useState(420);

  const cfgRef = useRef(cfg);
  const statusRef = useRef<Status>("inicio");
  const estRef = useRef<Estado>(null as unknown as Estado);
  if (!estRef.current) estRef.current = novoEstado(cfg);
  const accentRef = useRef(accent);
  const visivelRef = useRef(true);
  const trocouRef = useRef(false);
  const hudRef = useRef({ pontos: 0, nivel: 1 });

  cfgRef.current = cfg;
  accentRef.current = accent;

  useEffect(() => setRecorde(lerRecorde()), []);

  const mudarStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const atualizarHud = useCallback(() => {
    const e = estRef.current;
    const h = hudRef.current;
    if (h.pontos !== e.pontos || h.nivel !== e.nivel) {
      hudRef.current = { pontos: e.pontos, nivel: e.nivel };
      setHud(hudRef.current);
    }
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setLargura(w);
    });
    ro.observe(el);
    if (el.clientWidth) setLargura(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const cssW = Math.max(240, Math.floor(Math.min(largura, (560 * W) / H)));
  const cssH = Math.round((cssW * H) / W);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      visivelRef.current = e.isIntersecting;
      if (!e.isIntersecting && statusRef.current === "jogando") mudarStatus("pausado");
    });
    io.observe(el);
    return () => io.disconnect();
  }, [mudarStatus]);

  const iniciar = useCallback(
    (c: Config = cfgRef.current) => {
      estRef.current = novoEstado(c);
      hudRef.current = { pontos: 0, nivel: 1 };
      setHud(hudRef.current);
      mudarStatus("jogando");
      rootRef.current?.focus();
    },
    [mudarStatus],
  );

  const fim = useCallback(() => {
    const p = estRef.current.pontos;
    mudarStatus("fim");
    setRecorde((r) => {
      if (p > r) {
        salvarRecorde(p);
        return p;
      }
      return r;
    });
  }, [mudarStatus]);

  const atirar = useCallback(() => {
    const e = estRef.current;
    if (statusRef.current !== "jogando" || e.bola) return;
    const v = cfgRef.current.velocidadeTiro;
    e.bola = { x: LX, y: LY, vx: Math.cos(e.angulo) * v, vy: Math.sin(e.angulo) * v, cor: e.atual };
    e.recuo = 1;
  }, []);

  const trocar = useCallback(() => {
    const e = estRef.current;
    if (statusRef.current !== "jogando" || e.bola) return;
    const t = e.atual;
    e.atual = e.prox;
    e.prox = t;
  }, []);

  const descer = useCallback((e: Estado, c: Config) => {
    if (c.modoTeto === "desce") {
      e.descidas++;
      e.teto = TOPO + e.descidas * ROWH;
    } else {
      const pres = coresPresentes(e.grade);
      const lista = pres.length ? pres : [0, 1, 2];
      e.grade.pop();
      e.grade.unshift(Array.from({ length: COLS }, () => lista[Math.floor(Math.random() * lista.length)]));
      e.par ^= 1;
      e.tetoVis = e.teto - ROWH;
    }
    e.tremor = Math.max(e.tremor, 0.5);
  }, []);

  // Encaixa a bola na casa livre mais próxima e resolve estouros e quedas.
  const fixar = useCallback(() => {
    const e = estRef.current;
    const c = cfgRef.current;
    const b = e.bola;
    if (!b) return;
    e.bola = null;
    let melhor: [number, number] | null = null;
    let md = Infinity;
    for (let l = 0; l < LINHAS; l++)
      for (let k = 0; k < COLS; k++) {
        if (e.grade[l][k] !== null) continue;
        if (l > 0 && !vizP(l, k, COLS, LINHAS, e.par).some(([vl, vc]) => e.grade[vl][vc] !== null)) continue;
        const dx = posX(l, k, e.par) - b.x;
        const dy = posY(l, e.teto) - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < md) {
          md = d2;
          melhor = [l, k];
        }
      }
    if (!melhor) {
      fim();
      return;
    }
    const [ml, mc] = melhor;
    const bx = posX(ml, mc, e.par);
    const by = posY(ml, e.teto);
    let estourou = 0;

    if (b.cor === BOMBA) {
      const raio = D * 2.3;
      for (let l = 0; l < LINHAS; l++)
        for (let k = 0; k < COLS; k++) {
          const v = e.grade[l][k];
          if (v === null) continue;
          const x = posX(l, k, e.par);
          const y = posY(l, e.teto);
          if ((x - bx) ** 2 + (y - by) ** 2 <= raio * raio) {
            e.grade[l][k] = null;
            e.estouros.push({ x, y, cor: v, t: 0 });
            explodir(e, x, y, v, 6);
            estourou++;
          }
        }
      explodir(e, bx, by, BOMBA, 30);
      e.tremor = 1;
      if (estourou) {
        e.pontos += estourou * 10 * e.nivel;
        e.textos.push({ x: bx, y: by, txt: `+${estourou * 10 * e.nivel}`, t: 0 });
      }
    } else {
      e.grade[ml][mc] = b.cor;
      const g = grupoP(e.grade, ml, mc, e.par);
      if (g.length >= 3) {
        for (const [l, k] of g) {
          const x = posX(l, k, e.par);
          const y = posY(l, e.teto);
          e.grade[l][k] = null;
          e.estouros.push({ x, y, cor: b.cor, t: 0 });
          explodir(e, x, y, b.cor, 7);
        }
        estourou = g.length;
        const p = g.length * 10 * e.nivel;
        e.pontos += p;
        e.textos.push({ x: bx, y: by, txt: `+${p}`, t: 0 });
      }
    }

    // Cachos sem ligação com o teto caem.
    const s = soltosP(e.grade, e.par);
    if (s.length) {
      for (const [l, k] of s) {
        const v = e.grade[l][k] as number;
        e.caindo.push({ x: posX(l, k, e.par), y: posY(l, e.teto), vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, cor: v });
        e.grade[l][k] = null;
      }
      const p = s.length * 20 * e.nivel * (s.length >= 6 ? 2 : 1);
      e.pontos += p;
      e.textos.push({ x: bx, y: by + 24, txt: `Queda +${p}`, t: 0 });
    }

    // Nível limpo: só sobraram pedras (ou nada).
    if (!coresPresentes(e.grade).length) {
      for (let l = 0; l < LINHAS; l++)
        for (let k = 0; k < COLS; k++) {
          const v = e.grade[l][k];
          if (v !== null) e.caindo.push({ x: posX(l, k, e.par), y: posY(l, e.teto), vx: (Math.random() - 0.5) * 120, vy: -80, cor: v });
        }
      const bonus = 500 * e.nivel;
      e.pontos += bonus;
      e.textos.push({ x: W / 2, y: H / 2, txt: `Nível limpo +${bonus}`, t: 0 });
      e.nivel++;
      e.cores = Math.min(6, Math.max(3, Math.round(c.cores)) + e.nivel - 1);
      e.grade = montarGrade(e.cores, e.nivel, c.obstaculosExtras + (c.obstaculosExtras ? e.nivel - 1 : 0));
      e.par = 0;
      e.descidas = 0;
      e.teto = TOPO;
      e.tetoVis = TOPO - ROWH * 3;
      e.tiros = 0;
      e.atual = sortearCor(e, c);
      e.prox = sortearCor(e, c);
      atualizarHud();
      return;
    }

    e.tiros++;
    if (e.tiros % Math.max(1, Math.round(c.tirosParaDescer)) === 0) descer(e, c);

    atualizarHud();
    if (passouLinha(e)) {
      fim();
      return;
    }

    e.atual = e.prox;
    e.prox = sortearCor(e, c);
    const pres = coresPresentes(e.grade);
    if (e.atual < PEDRA && !pres.includes(e.atual)) e.atual = sortearCor(e, c);
    if (e.prox < PEDRA && !pres.includes(e.prox) && pres.length) e.prox = pres[Math.floor(Math.random() * pres.length)];
  }, [atualizarHud, descer, fim]);

  const passo = useCallback(() => {
    const e = estRef.current;
    e.angulo = Math.max(-Math.PI + 0.12, Math.min(-0.12, e.angulo + e.girar * 1.7 * DT));
    const b = e.bola;
    if (b) {
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      if (b.x < R) {
        b.x = 2 * R - b.x;
        b.vx = Math.abs(b.vx);
      } else if (b.x > W - R) {
        b.x = 2 * (W - R) - b.x;
        b.vx = -Math.abs(b.vx);
      }
      if (colideGrade(e, b.x, b.y, D * 0.86) || b.y < -R) fixar();
    }
  }, [fixar]);

  // Loop com passo fixo + desenho.
  useEffect(() => {
    let raf = 0;
    let ultimo = performance.now();
    const loop = (agora: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (agora - ultimo) / 1000));
      ultimo = agora;
      const e = estRef.current;
      if (statusRef.current === "jogando") {
        e.acc += dt;
        while (e.acc >= DT && statusRef.current === "jogando") {
          e.acc -= DT;
          passo();
        }
      }
      // Animações (continuam mesmo fora do jogo, para quedas finais).
      const ee = estRef.current;
      if (statusRef.current !== "pausado") {
        ee.tetoVis += (ee.teto - ee.tetoVis) * Math.min(1, dt * 9);
        for (const p of ee.parts) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 400 * dt;
          p.vida -= dt;
        }
        ee.parts = ee.parts.filter((p) => p.vida > 0);
        for (const q of ee.caindo) {
          q.vy += 1800 * dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
        }
        ee.caindo = ee.caindo.filter((q) => q.y < H + D);
        for (const s of ee.estouros) s.t += dt * 5;
        ee.estouros = ee.estouros.filter((s) => s.t < 1);
        for (const t of ee.textos) {
          t.t += dt;
          t.y -= 30 * dt;
        }
        ee.textos = ee.textos.filter((t) => t.t < 1.2);
        ee.tremor = Math.max(0, ee.tremor - dt * 2.5);
        ee.recuo = Math.max(0, ee.recuo - dt * 6);
      }
      if (visivelRef.current) desenhar(agora / 1000);
    };

    const esfera = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, cor: number, t: number) => {
      if (cor === PEDRA) {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
        g.addColorStop(0, "#C7CDD8");
        g.addColorStop(0.5, "#6B7486");
        g.addColorStop(1, "#2B313D");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(20,24,32,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.5, y - r * 0.1);
        ctx.lineTo(x - r * 0.1, y + r * 0.1);
        ctx.lineTo(x + r * 0.05, y + r * 0.5);
        ctx.moveTo(x - r * 0.1, y + r * 0.1);
        ctx.lineTo(x + r * 0.45, y - r * 0.15);
        ctx.stroke();
        return;
      }
      if (cor === BOMBA) {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
        g.addColorStop(0, "#5A6170");
        g.addColorStop(0.6, "#1C2029");
        g.addColorStop(1, "#08090C");
        ctx.save();
        ctx.shadowColor = "#FFB23D";
        ctx.shadowBlur = CORES[temaRef.current].bombaBlur + Math.sin(t * 10) * 4;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#C9A26B";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.35, y - r * 0.75);
        ctx.quadraticCurveTo(x + r * 0.6, y - r * 1.15, x + r * 0.9, y - r * 1.0);
        ctx.stroke();
        ctx.fillStyle = Math.sin(t * 20) > 0 ? "#FFF1A8" : "#FF8A3D";
        ctx.beginPath();
        ctx.arc(x + r * 0.9, y - r * 1.0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.28, r * 0.15, -0.5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const p = PALETA[cor] ?? PALETA[0];
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
      g.addColorStop(0, p.claro);
      g.addColorStop(0.45, p.base);
      g.addColorStop(1, p.escuro);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
      ctx.fill();
      const contorno = CORES[temaRef.current].contorno;
      if (contorno) {
        // Contorno suave na cor escura da própria bolha: separa bolhas vizinhas no fundo claro.
        ctx.save();
        ctx.globalAlpha *= contorno;
        ctx.strokeStyle = p.escuro;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.33, y - r * 0.42, r * 0.3, r * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(x + r * 0.35, y + r * 0.4, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    };

    const desenhar = (t: number) => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth || cssW;
      const h = cv.clientHeight || cssH;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      const s = w / W;
      const e = estRef.current;
      const ac = accentRef.current;
      const pal = CORES[temaRef.current];
      const tx = e.tremor > 0 ? (Math.random() - 0.5) * e.tremor * 6 : 0;
      const ty = e.tremor > 0 ? (Math.random() - 0.5) * e.tremor * 6 : 0;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, tx * dpr * s, ty * dpr * s);

      // Fundo
      const fundo = ctx.createLinearGradient(0, 0, 0, H);
      fundo.addColorStop(0, pal.fundo[0]);
      fundo.addColorStop(1, pal.fundo[1]);
      ctx.fillStyle = fundo;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.fillStyle = pal.pontos;
      for (let y = 0; y < H; y += 24) for (let x = (y / 24) % 2 ? 12 : 0; x < W; x += 24) ctx.fillRect(x, y, 2, 2);

      // Paredes laterais
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = ac;
      ctx.fillRect(0, 0, 2, H);
      ctx.fillRect(W - 2, 0, 2, H);
      ctx.restore();

      const teto = e.tetoVis;
      // Teto (barra que desce)
      if (teto > 0) {
        const gt = ctx.createLinearGradient(0, 0, 0, teto);
        gt.addColorStop(0, pal.teto[0]);
        gt.addColorStop(1, pal.teto[1]);
        ctx.fillStyle = gt;
        ctx.fillRect(0, 0, W, teto);
        ctx.fillStyle = pal.tetoListra;
        for (let x = -teto; x < W; x += 22) {
          ctx.beginPath();
          ctx.moveTo(x, teto);
          ctx.lineTo(x + 11, teto);
          ctx.lineTo(x + 11 + teto, 0);
          ctx.lineTo(x + teto, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.save();
        ctx.shadowColor = ac;
        ctx.shadowBlur = pal.tetoBlur;
        ctx.fillStyle = ac;
        ctx.fillRect(0, teto - 3, W, 3);
        ctx.restore();
      }

      // Linha limite
      let menorFolga = Infinity;
      for (let l = 0; l < LINHAS; l++)
        for (let k = 0; k < COLS; k++)
          if (e.grade[l][k] !== null) menorFolga = Math.min(menorFolga, LINHA_MORTE - (posY(l, e.teto) + R));
      const perigo = menorFolga < ROWH * 1.6;
      ctx.save();
      ctx.strokeStyle = perigo ? `rgba(255,77,109,${0.55 + Math.sin(t * 10) * 0.35})` : "rgba(255,77,109,0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.moveTo(0, LINHA_MORTE);
      ctx.lineTo(W, LINHA_MORTE);
      ctx.stroke();
      ctx.restore();

      // Grade de bolhas
      for (let l = 0; l < LINHAS; l++)
        for (let k = 0; k < COLS; k++) {
          const v = e.grade[l][k];
          if (v === null) continue;
          esfera(ctx, posX(l, k, e.par), posY(l, teto), R, v, t);
        }

      // Mira
      if (statusRef.current === "jogando" && !e.bola) {
        const m = tracarMira(e);
        const cAt = e.atual === BOMBA ? "#FFB23D" : e.atual === PEDRA ? "#9AA3B2" : (pal.contorno ? PALETA[e.atual]?.escuro : PALETA[e.atual]?.base) ?? pal.texto;
        ctx.fillStyle = cAt;
        m.pts.forEach(([x, y], i) => {
          ctx.globalAlpha = Math.max(0.1, 0.85 - i / m.pts.length);
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = cAt;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(m.fim[0], m.fim[1], R * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Lançador
      ctx.save();
      ctx.translate(LX, LY);
      const base = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
      base.addColorStop(0, pal.baseLanc);
      base.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(e.angulo + Math.PI / 2);
      ctx.translate(0, e.recuo * 5);
      ctx.fillStyle = pal.canoLanc;
      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(-6, -46);
      ctx.lineTo(6, -46);
      ctx.lineTo(9, -8);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.shadowColor = ac;
      ctx.shadowBlur = pal.lancBlur;
      ctx.fillStyle = ac;
      ctx.fillRect(-6, -50, 12, 5);
      ctx.restore();
      ctx.restore();
      ctx.fillStyle = pal.lancFundo;
      ctx.beginPath();
      ctx.arc(LX, LY, R + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.lancBorda;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (!e.bola && statusRef.current !== "fim") esfera(ctx, LX, LY, R, e.atual, t);

      // Próxima bolha
      ctx.fillStyle = pal.proxFundo;
      ctx.beginPath();
      ctx.arc(PX, PY, R * 0.8 + 6, 0, Math.PI * 2);
      ctx.fill();
      esfera(ctx, PX, PY, R * 0.72, e.prox, t);
      ctx.fillStyle = pal.rotulo;
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PRÓXIMA", PX, PY + R + 6);
      ctx.fillStyle = pal.rotulo2;
      ctx.fillText(`DESCE EM ${Math.max(1, Math.round(cfgRef.current.tirosParaDescer)) - (e.tiros % Math.max(1, Math.round(cfgRef.current.tirosParaDescer)))}`, LX + 96, PY + R + 6);

      // Bola em voo
      if (e.bola) {
        ctx.save();
        ctx.shadowColor = pal.bolaSombra;
        ctx.shadowBlur = 10;
        esfera(ctx, e.bola.x, e.bola.y, R, e.bola.cor, t);
        ctx.restore();
      }

      // Caindo
      for (const q of e.caindo) esfera(ctx, q.x, q.y, R, q.cor, t);

      // Estouros (anel que expande)
      for (const s2 of e.estouros) {
        const c = s2.cor === PEDRA ? "#9AA3B2" : s2.cor === BOMBA ? "#FFB23D" : PALETA[s2.cor].base;
        ctx.globalAlpha = 1 - s2.t;
        ctx.strokeStyle = c;
        ctx.lineWidth = 3 * (1 - s2.t) + 0.5;
        ctx.beginPath();
        ctx.arc(s2.x, s2.y, R * (0.6 + s2.t * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const p of e.parts) {
        ctx.globalAlpha = Math.max(0, p.vida / p.max);
        ctx.fillStyle = p.cor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Textos de pontos
      ctx.textAlign = "center";
      ctx.font = "700 16px system-ui, sans-serif";
      for (const tx2 of e.textos) {
        ctx.globalAlpha = Math.max(0, 1 - tx2.t / 1.2);
        ctx.fillStyle = pal.texto;
        ctx.fillText(tx2.txt, tx2.x, tx2.y);
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cssW, cssH, passo]);

  const trocarVariacao = (n: NomeVariacao) => {
    setNomeVar(n);
    setCfg(VARIACOES[n]);
    cfgRef.current = VARIACOES[n];
    estRef.current = novoEstado(VARIACOES[n]);
    hudRef.current = { pontos: 0, nivel: 1 };
    setHud(hudRef.current);
    mudarStatus("inicio");
    rootRef.current?.focus();
  };

  const alternarTiro = () => {
    const c: Config = { ...cfgRef.current, tipoTiro: cfgRef.current.tipoTiro === "bomba" ? "simples" : "bomba" };
    setCfg(c);
    cfgRef.current = c;
    rootRef.current?.focus();
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    const k = ev.key;
    if (k.startsWith("Arrow") || k === " ") ev.preventDefault();
    const s = statusRef.current;
    if (k === " " || k === "Enter") {
      if (s === "inicio" || s === "fim") iniciar();
      else if (s === "pausado") mudarStatus("jogando");
      else atirar();
      return;
    }
    if (k === "p" || k === "P") {
      if (s === "jogando") mudarStatus("pausado");
      else if (s === "pausado") mudarStatus("jogando");
      return;
    }
    if (k === "c" || k === "C") trocar();
    if (k === "ArrowLeft" || k === "a" || k === "A") estRef.current.girar = -1;
    if (k === "ArrowRight" || k === "d" || k === "D") estRef.current.girar = 1;
    if (k === "ArrowUp" || k === "w" || k === "W") atirar();
  };

  const onKeyUp = (ev: KeyboardEvent<HTMLDivElement>) => {
    const k = ev.key;
    const e = estRef.current;
    if ((k === "ArrowLeft" || k === "a" || k === "A") && e.girar < 0) e.girar = 0;
    if ((k === "ArrowRight" || k === "d" || k === "D") && e.girar > 0) e.girar = 0;
  };

  const onBlur = (ev: FocusEvent<HTMLDivElement>) => {
    if (rootRef.current?.contains(ev.relatedTarget as Node)) return;
    estRef.current.girar = 0;
    if (statusRef.current === "jogando") mudarStatus("pausado");
  };

  // Ponteiro sobre o canvas: mira; clique/soltar atira; tocar na próxima troca.
  const pontoVirtual = (ev: PointerEvent<HTMLCanvasElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((ev.clientX - r.left) * W) / r.width, y: ((ev.clientY - r.top) * H) / r.height };
  };
  const mirarEm = (p: { x: number; y: number }) => {
    const dy = Math.min(p.y - LY, -8);
    const a = Math.atan2(dy, p.x - LX);
    estRef.current.angulo = Math.max(-Math.PI + 0.12, Math.min(-0.12, a));
  };
  const onCanvasMove = (ev: PointerEvent<HTMLCanvasElement>) => {
    if (statusRef.current !== "jogando") return;
    const p = pontoVirtual(ev);
    if (p && !trocouRef.current) mirarEm(p);
  };
  const onCanvasDown = (ev: PointerEvent<HTMLCanvasElement>) => {
    ev.preventDefault();
    rootRef.current?.focus();
    if (statusRef.current !== "jogando") return;
    const p = pontoVirtual(ev);
    trocouRef.current = false;
    if (!p) return;
    if ((p.x - PX) ** 2 + (p.y - PY) ** 2 < 34 * 34) {
      trocouRef.current = true;
      trocar();
      return;
    }
    mirarEm(p);
  };
  const onCanvasUp = (ev: PointerEvent<HTMLCanvasElement>) => {
    ev.preventDefault();
    if (trocouRef.current) {
      trocouRef.current = false;
      return;
    }
    if (statusRef.current !== "jogando") return;
    const p = pontoVirtual(ev);
    if (p) mirarEm(p);
    atirar();
  };

  const botaoGiro = (dir: number, rotulo: string, d: string) => (
    <button
      type="button"
      aria-label={rotulo}
      onPointerDown={(ev) => {
        ev.preventDefault();
        if (statusRef.current === "jogando") estRef.current.girar = dir;
        else if (statusRef.current !== "pausado") iniciar();
      }}
      onPointerUp={(ev) => {
        ev.preventDefault();
        estRef.current.girar = 0;
      }}
      onPointerLeave={() => {
        estRef.current.girar = 0;
      }}
      onPointerCancel={() => {
        estRef.current.girar = 0;
      }}
      className="flex h-14 w-14 touch-none select-none items-center justify-center rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface-2)] text-[var(--fc-text)] active:bg-[var(--fc-border)]"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path d={d} />
      </svg>
    </button>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      style={{ ...TEMAS[temaAtual], "--accent": accent } as CSSProperties}
      className="relative mx-auto w-full max-w-5xl select-none overflow-hidden rounded-3xl border border-[var(--fc-border)] bg-[var(--fc-bg)] p-3 shadow-[var(--fc-shadow)] text-[var(--fc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:p-5"
    >
      {/* HUD */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
          <span className="text-sm font-semibold tracking-tight">Estoura Balões</span>
          <BotaoTema tema={temaAtual} onClick={alternarTema} />
        </div>
        <div className="flex gap-4 text-xs text-[var(--fc-muted)]">
          <span>
            Pontos <b className="ml-1 font-semibold tabular-nums text-[var(--fc-text)]">{hud.pontos}</b>
          </span>
          <span>
            Recorde <b className="ml-1 font-semibold tabular-nums text-[var(--fc-text)]">{recorde}</b>
          </span>
          <span>
            Nível <b className="ml-1 font-semibold tabular-nums text-[var(--fc-text)]">{hud.nivel}</b>
          </span>
        </div>
      </div>

      {/* Variações */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] uppercase tracking-wider text-[var(--fc-subtle)]">Variações</span>
        {(Object.keys(VARIACOES) as NomeVariacao[]).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => trocarVariacao(n)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              nomeVar === n
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={alternarTiro}
          className="ml-auto rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-1 text-xs text-[var(--fc-muted)] transition-colors hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]"
        >
          {cfg.tipoTiro === "bomba" ? "Com bombas" : "Tiro simples"}
        </button>
      </div>

      {/* Tabuleiro */}
      <div ref={areaRef} className="flex w-full justify-center">
        <div className="relative" style={{ width: cssW, height: cssH }}>
          <canvas
            ref={canvasRef}
            onPointerMove={onCanvasMove}
            onPointerDown={onCanvasDown}
            onPointerUp={onCanvasUp}
            className="block h-full w-full cursor-crosshair touch-none rounded-2xl"
            style={{ width: cssW, height: cssH }}
          />
          {status !== "jogando" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--fc-bg)_75%,transparent)] text-center backdrop-blur-[2px]">
              {status === "fim" && (
                <>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--fc-subtle)]">Fim de jogo</p>
                  <p className="text-4xl font-semibold tabular-nums">{hud.pontos}</p>
                  <p className="text-xs text-[var(--fc-muted)]">
                    Recorde <span className="tabular-nums text-[var(--fc-text)]">{recorde}</span>
                  </p>
                </>
              )}
              {status === "pausado" && <p className="text-lg font-semibold">Pausado</p>}
              {status === "inicio" && (
                <>
                  <p className="text-lg font-semibold">Estoura Balões</p>
                  <p className="max-w-[16rem] text-xs text-[var(--fc-muted)]">Junte 3 da mesma cor. Cachos soltos caem e valem o dobro.</p>
                </>
              )}
              <button
                type="button"
                onClick={() => (status === "pausado" ? (mudarStatus("jogando"), rootRef.current?.focus()) : iniciar())}
                className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_32px_-8px_var(--accent)] transition hover:brightness-110"
              >
                {status === "fim" ? "Jogar de novo" : status === "pausado" ? "Continuar" : "Clique para jogar"}
              </button>
              {status === "inicio" || status === "pausado" ? (
                <ComoJogar className="hidden sm:block" />
              ) : (
                <p className="hidden text-[11px] text-[var(--fc-subtle)] sm:block">Clique ou aperte Espaço · P pausa</p>
              )}
              <p className="text-[11px] text-[var(--fc-muted)] sm:hidden">{RESUMO_TOQUE}</p>
              <a href={LINK} target="_blank" rel="noopener" className="text-[10px] text-[var(--fc-subtle)] hover:text-[var(--fc-muted)]">
                Criado por FlowCore Soluções LTDA
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Controles de toque */}
      <div className="mt-4 flex items-center justify-center gap-2 sm:hidden">
        {botaoGiro(-1, "Girar mira para a esquerda", "M6 12l9-7v14z")}
        <button
          type="button"
          aria-label="Trocar bolha"
          onPointerDown={(ev) => {
            ev.preventDefault();
            trocar();
          }}
          className="flex h-14 w-14 touch-none select-none items-center justify-center rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface-2)] text-[var(--fc-text)] active:bg-[var(--fc-border)]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M4 9h13l-3-3M20 15H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Atirar"
          onPointerDown={(ev) => {
            ev.preventDefault();
            if (statusRef.current === "jogando") atirar();
            else if (statusRef.current !== "pausado") iniciar();
          }}
          className="flex h-14 w-20 touch-none select-none items-center justify-center rounded-2xl border border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_24px_-8px_var(--accent)] active:brightness-110"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path d="M12 3l6 8h-4v10h-4V11H6z" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Pausar"
          onPointerDown={(ev) => {
            ev.preventDefault();
            const s = statusRef.current;
            if (s === "jogando") mudarStatus("pausado");
            else if (s === "pausado") mudarStatus("jogando");
            else iniciar();
          }}
          className="flex h-14 w-14 touch-none items-center justify-center rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d={status === "jogando" ? "M7 5h3v14H7zM14 5h3v14h-3z" : "M8 5l11 7-11 7z"} />
          </svg>
        </button>
        {botaoGiro(1, "Girar mira para a direita", "M18 12L9 19V5z")}
      </div>

      {/* Como jogar no celular: fica fora do canvas, que é pequeno na tela estreita */}
      {status !== "jogando" && <ComoJogar className="mx-auto mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-4 py-3 sm:hidden" />}

      {/* Rodapé com assinatura */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[var(--fc-border)] pt-3 text-center sm:justify-between sm:text-left">
        <span className="hidden text-[11px] text-[var(--fc-muted)] sm:inline">{RESUMO_TECLADO}</span>
        <span className="text-[11px] text-[var(--fc-muted)] sm:hidden">{RESUMO_TOQUE}</span>
        <a href={LINK} target="_blank" rel="noopener" className="text-[11px] text-[var(--fc-subtle)] transition-colors hover:text-[var(--fc-muted)]">
          Criado por FlowCore Soluções LTDA
        </a>
      </div>
    </div>
  );
}
