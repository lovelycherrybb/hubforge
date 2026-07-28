"use client";

import { useEffect, useRef } from "react";

/**
 * 粒子线条图标 — 交通+咨询主题
 * 粒子更细、轮廓更精细
 */

interface Point { x: number; y: number; }

// ── 图标路径生成器 ──────────────────────────────────────

/** 安全帽 */
function helmetPoints(cx: number, cy: number, s: number): Point[] {
  const pts: Point[] = [];
  // 帽顶弧线（更密的采样）
  for (let a = Math.PI * 1.1; a >= -Math.PI * 0.1; a -= 0.08) {
    pts.push({
      x: cx + Math.cos(a) * 26 * s,
      y: cy - 6 * s + Math.sin(a) * -20 * s,
    });
  }
  // 帽檐上沿
  for (let x = -30; x <= 30; x += 2.5) {
    pts.push({ x: cx + x * s, y: cy + 14 * s });
  }
  // 帽檐下弧
  for (let a = 0; a <= Math.PI; a += 0.15) {
    pts.push({
      x: cx + Math.cos(a) * 32 * s,
      y: cy + 14 * s + Math.sin(a) * 4 * s,
    });
  }
  // 帽中线
  for (let y = -6; y <= 14; y += 2) {
    pts.push({ x: cx, y: cy + y * s });
  }
  return pts;
}

/** 咨询人员（半身像） */
function personPoints(cx: number, cy: number, s: number): Point[] {
  const pts: Point[] = [];
  // 头部圆形
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    pts.push({
      x: cx + Math.cos(a) * 10 * s,
      y: cy - 20 * s + Math.sin(a) * 12 * s,
    });
  }
  // 领带/领口
  for (let y = -6; y <= 6; y += 1.5) {
    pts.push({ x: cx, y: cy + y * s });
  }
  // 肩部弧线（西装轮廓）
  for (let a = Math.PI * 1.2; a >= -Math.PI * 0.2; a -= 0.08) {
    pts.push({
      x: cx + Math.cos(a) * 24 * s,
      y: cy + 12 * s + Math.sin(a) * -14 * s,
    });
  }
  // 左右衣领
  for (let t = 0; t <= 1; t += 0.1) {
    pts.push({
      x: cx + (-2 + t * -12) * s,
      y: cy + (8 + t * 12) * s,
    });
    pts.push({
      x: cx + (2 + t * 12) * s,
      y: cy + (8 + t * 12) * s,
    });
  }
  return pts;
}

/** 咨询方案（文档+图表） */
function documentPoints(cx: number, cy: number, s: number): Point[] {
  const pts: Point[] = [];
  // 文档外框
  for (let x = -18; x <= 18; x += 2) {
    pts.push({ x: cx + x * s, y: cy - 24 * s });
    pts.push({ x: cx + x * s, y: cy + 24 * s });
  }
  for (let y = -24; y <= 24; y += 2) {
    pts.push({ x: cx - 18 * s, y: cy + y * s });
    pts.push({ x: cx + 18 * s, y: cy + y * s });
  }
  // 折角
  for (let t = 0; t <= 1; t += 0.1) {
    pts.push({
      x: cx + (10 + t * 8) * s,
      y: cy + (-24 + t * 8) * s,
    });
  }
  // 横线（文字行）
  for (let i = 0; i < 3; i++) {
    const y = -10 + i * 8;
    for (let x = -12; x <= 12; x += 2.5) {
      pts.push({ x: cx + x * s, y: cy + y * s });
    }
  }
  // 柱状图
  const barX = [-8, -2, 4];
  const barH = [10, 16, 7];
  barX.forEach((bx, i) => {
    for (let y = 0; y <= barH[i]; y += 2) {
      pts.push({ x: cx + bx * s, y: cy + (18 - y) * s });
    }
  });
  return pts;
}

/** 桥梁（斜拉桥） */
function bridgePoints(cx: number, cy: number, s: number): Point[] {
  const pts: Point[] = [];
  // 桥面
  for (let x = -48; x <= 48; x += 2) {
    pts.push({ x: cx + x * s, y: cy + 6 * s });
  }
  // 主塔（两座）
  [-18, 18].forEach(tx => {
    for (let y = -28; y <= 6; y += 2) {
      pts.push({ x: cx + tx * s, y: cy + y * s });
    }
    // 塔顶横梁
    for (let x = -4; x <= 4; x += 2) {
      pts.push({ x: cx + (tx + x) * s, y: cy - 28 * s });
    }
  });
  // 拉索（左右各 4 根）
  for (let i = 1; i <= 4; i++) {
    const t = i / 4.5;
    // 左塔左侧索
    for (let f = 0; f <= 1; f += 0.1) {
      pts.push({
        x: cx + (-18 + f * (-30 + t * 10)) * s,
        y: cy + (-28 + f * (34 - t * 6)) * s,
      });
    }
    // 左塔右侧索
    for (let f = 0; f <= 1; f += 0.1) {
      pts.push({
        x: cx + (-18 + f * (t * 16)) * s,
        y: cy + (-28 + f * (34 - t * 4)) * s,
      });
    }
    // 右塔左侧索
    for (let f = 0; f <= 1; f += 0.1) {
      pts.push({
        x: cx + (18 - f * (t * 16)) * s,
        y: cy + (-28 + f * (34 - t * 4)) * s,
      });
    }
    // 右塔右侧索
    for (let f = 0; f <= 1; f += 0.1) {
      pts.push({
        x: cx + (18 + f * (30 - t * 10)) * s,
        y: cy + (-28 + f * (34 - t * 6)) * s,
      });
    }
  }
  // 桥墩
  [-35, -18, 18, 35].forEach(px => {
    for (let y = 6; y <= 18; y += 2) {
      pts.push({ x: cx + px * s, y: cy + y * s });
    }
  });
  return pts;
}

/** 互通枢纽（立交匝道） */
function interchangePoints(cx: number, cy: number, s: number): Point[] {
  const pts: Point[] = [];
  // 主线 — 横向
  for (let x = -45; x <= 45; x += 2) {
    pts.push({ x: cx + x * s, y: cy + 4 * s });
  }
  // 主线 — 纵向
  for (let y = -35; y <= 35; y += 2) {
    pts.push({ x: cx + 2 * s, y: cy + y * s });
  }
  // 右上匝道弧
  for (let t = 0; t <= 1; t += 0.04) {
    const a = Math.PI * 0.5 + t * Math.PI * 0.6;
    const r = 22 + t * 8;
    pts.push({
      x: cx + Math.cos(a) * r * s + 20 * s,
      y: cy + Math.sin(a) * r * s - 10 * s,
    });
  }
  // 左下匝道弧
  for (let t = 0; t <= 1; t += 0.04) {
    const a = -Math.PI * 0.4 + t * Math.PI * 0.5;
    const r = 20 + t * 10;
    pts.push({
      x: cx + Math.cos(a) * r * s - 18 * s,
      y: cy + Math.sin(a) * r * s + 12 * s,
    });
  }
  // 右下匝道弧
  for (let t = 0; t <= 1; t += 0.04) {
    const a = Math.PI * 1.2 + t * Math.PI * 0.5;
    const r = 18 + t * 12;
    pts.push({
      x: cx + Math.cos(a) * r * s + 15 * s,
      y: cy + Math.sin(a) * r * s + 10 * s,
    });
  }
  // 左上匝道弧
  for (let t = 0; t <= 1; t += 0.04) {
    const a = -Math.PI * 0.8 + t * Math.PI * 0.5;
    const r = 22 + t * 6;
    pts.push({
      x: cx + Math.cos(a) * r * s - 15 * s,
      y: cy + Math.sin(a) * r * s - 12 * s,
    });
  }
  // 交汇区域的小环岛
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    pts.push({
      x: cx + Math.cos(a) * 8 * s,
      y: cy + Math.sin(a) * 8 * s,
    });
  }
  return pts;
}

// ── 图标配置 ──────────────────────────────────────────

interface IconConfig {
  generator: (cx: number, cy: number, s: number) => Point[];
  cx: number; cy: number; scale: number;
  color: string; glowColor: string;
  driftAmpX: number; driftAmpY: number; driftSpeed: number; phase: number;
}

const ICONS: IconConfig[] = [
  {
    generator: helmetPoints,
    cx: 0.2, cy: 0.2, scale: 1.6,
    color: "rgba(255,255,255,0.75)",
    glowColor: "rgba(100,180,255,0.25)",
    driftAmpX: 6, driftAmpY: 10, driftSpeed: 0.00035, phase: 0,
  },
  {
    generator: personPoints,
    cx: 0.72, cy: 0.2, scale: 1.6,
    color: "rgba(120,190,255,0.7)",
    glowColor: "rgba(100,170,255,0.22)",
    driftAmpX: 8, driftAmpY: 7, driftSpeed: 0.0003, phase: 1.8,
  },
  {
    generator: documentPoints,
    cx: 0.2, cy: 0.58, scale: 1.5,
    color: "rgba(255,255,255,0.65)",
    glowColor: "rgba(100,200,255,0.2)",
    driftAmpX: 5, driftAmpY: 12, driftSpeed: 0.0004, phase: 3.5,
  },
  {
    generator: bridgePoints,
    cx: 0.7, cy: 0.62, scale: 1.3,
    color: "rgba(100,200,255,0.65)",
    glowColor: "rgba(80,180,255,0.2)",
    driftAmpX: 10, driftAmpY: 8, driftSpeed: 0.00032, phase: 5,
  },
  {
    generator: interchangePoints,
    cx: 0.45, cy: 0.82, scale: 1.2,
    color: "rgba(255,220,100,0.6)",
    glowColor: "rgba(255,200,60,0.18)",
    driftAmpX: 7, driftAmpY: 9, driftSpeed: 0.00038, phase: 6.5,
  },
];

// ── 组件 ──────────────────────────────────────────────

export function ParticleIcons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const dataRef = useRef<
    { x: number; y: number; r: number; baseAlpha: number; speed: number; phase: number }[][]
  >([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.offsetWidth;
      const h = parent.offsetHeight;
      canvas.width = w;
      canvas.height = h;

      // 重新生成粒子位置
      dataRef.current = ICONS.map((icon) => {
        const icx = w * icon.cx;
        const icy = h * icon.cy;
        const pts = icon.generator(icx, icy, icon.scale);
        return pts.map((p) => ({
          x: p.x,
          y: p.y,
          r: 0.3 + Math.random() * 0.6,
          baseAlpha: 0.45 + Math.random() * 0.5,
          speed: 0.6 + Math.random() * 1.2,
          phase: Math.random() * Math.PI * 2,
        }));
      });
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now();

      ICONS.forEach((icon, idx) => {
        const particles = dataRef.current[idx];
        if (!particles) return;

        const driftX = Math.sin(time * icon.driftSpeed + icon.phase) * icon.driftAmpX;
        const driftY = Math.cos(time * icon.driftSpeed * 0.7 + icon.phase) * icon.driftAmpY;

        particles.forEach((p) => {
          const pulse = Math.sin(time * 0.001 * p.speed + p.phase);
          const alpha = p.baseAlpha * (0.3 + 0.7 * (0.5 + 0.5 * pulse));
          const x = p.x + driftX;
          const y = p.y + driftY;
          const r = p.r * (0.8 + 0.2 * pulse);

          // 外发光
          ctx!.globalAlpha = alpha * 0.4;
          const glow = ctx!.createRadialGradient(x, y, 0, x, y, r * 2.5);
          glow.addColorStop(0, icon.glowColor);
          glow.addColorStop(1, "transparent");
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(x, y, r * 3, 0, Math.PI * 2);
          ctx!.fill();

          // 核心粒子
          ctx!.globalAlpha = alpha;
          ctx!.fillStyle = icon.color;
          ctx!.beginPath();
          ctx!.arc(x, y, r, 0, Math.PI * 2);
          ctx!.fill();
        });
      });

      ctx!.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5] pointer-events-none"
    />
  );
}
