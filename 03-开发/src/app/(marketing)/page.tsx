"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

// ── 导航栏 ──────────────────────────────────────────
function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            alt="华检科"
            className="w-7 h-7 md:w-8 md:h-8 rounded object-cover"
          />
          <span className="font-bold text-white text-sm md:text-base tracking-tight">
            华检科 HubForge
          </span>
        </Link>

        <Link
          href="/login"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          登录
        </Link>
      </div>
    </nav>
  );
}

// ── Hero 区 ─────────────────────────────────────────
function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * 2;
      canvas.height = window.innerHeight * 2;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    // 星空粒子
    const stars: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: Math.random() * canvas.width - canvas.width / 2,
        y: Math.random() * canvas.height - canvas.height / 2,
        z: Math.random() * canvas.width,
      });
    }

    // 性能检测
    let frameCount = 0;
    let lastFrameTime = 0;
    let showEffects = true;

    function draw(time: number) {
      if (!canvas || !ctx) return;

      // 性能检测
      if (frameCount < 120 && showEffects) {
        if (frameCount > 0 && time - lastFrameTime > 20) {
          showEffects = false;
        }
        lastFrameTime = time;
        frameCount++;
      }

      const w = canvas.width;
      const h = canvas.height;

      // 背景
      ctx.fillStyle = "#0a0a15";
      ctx.fillRect(0, 0, w, h);

      if (showEffects) {
        // 星空
        const cx = w / 2;
        const cy = h / 2;
        for (const star of stars) {
          star.z -= 3;
          if (star.z <= 0) {
            star.z = w;
            star.x = Math.random() * w - w / 2;
            star.y = Math.random() * h - h / 2;
          }
          const k = 300 / star.z;
          const px = star.x * k + cx;
          const py = star.y * k + cy;
          const r = (1 - star.z / w) * 3;
          if (px >= 0 && px <= w && py >= 0 && py <= h) {
            const alpha = 1 - star.z / w;
            const prevZ = star.z + 8;
            const pk = 300 / prevZ;
            const ppx = star.x * pk + cx;
            const ppy = star.y * pk + cy;
            ctx.strokeStyle = `rgba(180,210,255,${alpha * 0.3})`;
            ctx.lineWidth = r * 0.6;
            ctx.beginPath();
            ctx.moveTo(ppx, ppy);
            ctx.lineTo(px, py);
            ctx.stroke();
            ctx.fillStyle = `rgba(200,225,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Mesh Gradient
        const blobs = [
          { x: w * 0.2, y: h * 0.3, r: w * 0.3, color: [60, 20, 180] },
          { x: w * 0.75, y: h * 0.15, r: w * 0.28, color: [20, 140, 255] },
          { x: w * 0.5, y: h * 0.7, r: w * 0.32, color: [160, 40, 200] },
          { x: w * 0.85, y: h * 0.75, r: w * 0.25, color: [0, 200, 200] },
          { x: w * 0.1, y: h * 0.85, r: w * 0.22, color: [200, 50, 120] },
        ];
        const t0 = time * 0.001;
        ctx.globalCompositeOperation = "lighter";
        blobs.forEach((b, i) => {
          const phase = i * 1.7;
          const ox =
            (Math.sin(t0 * 1.3 + phase) * 0.5 +
              Math.sin(t0 * 0.7 + phase * 2.3) * 0.3 +
              Math.sin(t0 * 2.1 + phase * 0.5) * 0.2) *
            w *
            0.15;
          const oy =
            (Math.cos(t0 * 0.9 + phase * 1.5) * 0.5 +
              Math.cos(t0 * 1.8 + phase * 0.8) * 0.3 +
              Math.cos(t0 * 0.4 + phase * 2.7) * 0.2) *
            h *
            0.15;
          const cr = b.color[0] + Math.sin(t0 * 0.8 + i * 2) * 60;
          const cg = b.color[1] + Math.sin(t0 * 1.1 + i * 3) * 50;
          const cb = b.color[2] + Math.cos(t0 * 0.6 + i * 1.5) * 60;
          const g = ctx!.createRadialGradient(
            b.x + ox,
            b.y + oy,
            0,
            b.x + ox,
            b.y + oy,
            b.r
          );
          g.addColorStop(0, `rgba(${cr},${cg},${cb},0.22)`);
          g.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.08)`);
          g.addColorStop(1, "transparent");
          ctx!.fillStyle = g;
          ctx!.fillRect(0, 0, w, h);
        });
        ctx.globalCompositeOperation = "source-over";
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      <div className="relative z-10 text-center px-4 md:px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight mb-6">
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #4a9eff, #a855f7, #ec4899, #f59e0b, #4a9eff)",
              backgroundSize: "300%",
              animation: "gradient-flow 4s linear infinite",
            }}
          >
            华检科 HubForge
          </span>
        </h1>
        <p className="text-base md:text-lg lg:text-xl text-gray-400 mb-10 max-w-xl mx-auto">
          质量安全领域的AI应用门户
        </p>
      </div>
    </section>
  );
}

// ── 首页 ──────────────────────────────────────────
export default function HomePage() {
  return (
    <main className="bg-[#0a0a15] min-h-screen">
      <NavBar />
      <HeroSection />
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center">
        <p className="text-xs text-gray-600">
          © 2026 华设检测科技有限公司
        </p>
      </footer>
    </main>
  );
}
