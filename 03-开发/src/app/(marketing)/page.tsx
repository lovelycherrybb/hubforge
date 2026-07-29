"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// ── 导航栏 ──────────────────────────────────────────
function NavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0a15]/90 backdrop-blur-md border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="华检科" className="w-8 h-8 rounded object-cover" />
          <span className="font-bold text-white tracking-tight">
            华检科 HubForge
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <a
            href="#products"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            产品
          </a>
          <a
            href="#solutions"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            解决方案
          </a>
          <Link
            href="/about"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            关于我们
          </Link>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            登录
          </Link>
        </div>
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
      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
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
        <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-xl mx-auto">
          质量安全领域的AI应用门户。一站式管理检测、监测、巡检、报告全流程。
        </p>
      </div>
    </section>
  );
}

// ── 数据背书 ──────────────────────────────────────
function StatsSection() {
  return (
    <section className="py-16 border-y border-white/5">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { num: "200+", label: "服务企业" },
          { num: "50万+", label: "检测报告/年" },
          { num: "99.9%", label: "系统可用性" },
          { num: "CMA/CNAS", label: "双重认证" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-[#4a9eff] mb-2">
              {s.num}
            </div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── AI 产品矩阵 ──────────────────────────────────
function ProductsSection() {
  const products = [
    {
      title: "AI 检测报告",
      desc: "自动填充检测数据，智能校验数值异常，一键生成标准格式报告",
    },
    {
      title: "AI 智能巡检",
      desc: "图像识别缺陷，无人机自动巡检，巡检结果实时同步",
    },
    {
      title: "AI 风险预警",
      desc: "趋势预测预警，异常自动报警，风险等级动态评估",
    },
    {
      title: "AI 合规审查",
      desc: "自动合规检查，标准条文匹配，审查报告一键生成",
    },
    {
      title: "AI 设备健康",
      desc: "预测性维护，故障提前预警，设备状态实时监控",
    },
    {
      title: "智能问数",
      desc: "自然语言查数据，告别写SQL，一句话出报表",
    },
    {
      title: "数字人培训考核",
      desc: "AI一对一陪练，考核自动评分，培训记录全程留痕",
    },
    {
      title: "桌面应急演练",
      desc: "沉浸式桌面推演，场景模拟演练，演练报告自动生成",
    },
    {
      title: "检测数据中台",
      desc: "数据资产化，统一数据管理，跨系统数据打通",
    },
  ];

  return (
    <section id="products" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            AI 产品矩阵
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            以下是部分 AI 产品示例，更多产品持续上线中
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:border-[#4a9eff]/30 hover:bg-white/[0.04] transition-all"
            >
              <h3 className="text-lg font-semibold text-white mb-2">
                {p.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 为什么选择 ──────────────────────────────────
function WhySection() {
  const reasons = [
    {
      title: "20年检测经验",
      desc: "华设集团旗下，深耕质量安全检测领域，懂行业Know-How",
    },
    {
      title: "AI不是替代人",
      desc: "把老师傅的经验变成AI能力，让新人也能做出老师傅的判断",
    },
    {
      title: "从报告到决策",
      desc: "不止自动生成报告，更帮你从数据里发现问题、预判风险",
    },
    {
      title: "咨询+产品一体化",
      desc: "先帮你梳理业务流程，再用AI固化到系统里，不是买个软件自己搞",
    },
  ];

  return (
    <section className="py-24 border-y border-white/5">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
          为什么选择 HubForge
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {reasons.map((r) => (
            <div key={r.title} className="text-center">
              <div className="text-xl font-semibold text-white mb-3">
                {r.title}
              </div>
              <p className="text-sm text-gray-400">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 行业解决方案 ──────────────────────────────
function SolutionsSection() {
  const [activeTab, setActiveTab] = useState(0);
  const solutions = [
    {
      name: "交通工程",
      pain: "桥梁/隧道检测周期长、人工成本高",
      solution: "AI 图像识别裂缝、无人机自动巡检",
      standard: "JTG H11 公路桥涵养护规范",
    },
    {
      name: "建筑工程",
      pain: "隐蔽工程质量追溯难、验收标准不统一",
      solution: "AI 质量评分、验收标准自动匹配",
      standard: "GB 50300 建筑工程施工质量验收统一标准",
    },
    {
      name: "环境监测",
      pain: "数据量大、人工分析效率低",
      solution: "AI 趋势分析、异常自动预警",
      standard: "HJ 91.1 污水监测技术规范",
    },
    {
      name: "水利水电",
      pain: "大坝安全监测数据分散",
      solution: "AI 数据融合、安全状态评估",
      standard: "SL 601 混凝土坝安全监测技术规范",
    },
  ];

  return (
    <section id="solutions" className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
          行业解决方案
        </h2>
        <div className="flex justify-center gap-2 mb-12 flex-wrap">
          {solutions.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveTab(i)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === i
                  ? "bg-[#4a9eff] text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="p-8 rounded-2xl border border-white/5 bg-white/[0.02]">
          <h3 className="text-xl font-semibold text-white mb-6">
            {solutions[activeTab].name}检测
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-2">场景痛点</div>
              <p className="text-gray-300">{solutions[activeTab].pain}</p>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-2">AI 解决方案</div>
              <p className="text-gray-300">{solutions[activeTab].solution}</p>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-2">对应标准</div>
              <p className="text-gray-300">{solutions[activeTab].standard}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CTA ──────────────────────────────────────────
function CTASection() {
  return (
    <section className="py-24 border-y border-white/5">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          让 AI 为你的检测业务赋能
        </h2>
        <p className="text-gray-400 mb-10">
          华检科 HubForge，质量安全领域的AI应用门户
        </p>
      </div>
    </section>
  );
}

// ── Footer ──────────────────────────────────────
function Footer() {
  return (
    <footer className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="华检科" className="w-7 h-7 rounded object-cover" />
              <span className="font-bold text-white text-sm">
                华检科 HubForge
              </span>
            </div>
            <p className="text-sm text-gray-500">
              质量安全领域的AI应用门户
            </p>
          </div>
          <div>
            <div className="text-sm font-medium text-white mb-4">产品</div>
            <div className="space-y-2">
              <a
                href="#products"
                className="block text-sm text-gray-400 hover:text-white"
              >
                AI产品矩阵
              </a>
              <a
                href="#solutions"
                className="block text-sm text-gray-400 hover:text-white"
              >
                行业解决方案
              </a>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-white mb-4">公司</div>
            <div className="space-y-2">
              <Link
                href="/about"
                className="block text-sm text-gray-400 hover:text-white"
              >
                关于我们
              </Link>
              <a
                href="mailto:info@huajianke.com"
                className="block text-sm text-gray-400 hover:text-white"
              >
                联系我们
              </a>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-white mb-4">联系</div>
            <div className="space-y-2 text-sm text-gray-400">
              <p>南京市</p>
              <p>info@huajianke.com</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © 2026 华设检测科技有限公司
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-gray-600 hover:text-gray-400">
              隐私政策
            </a>
            <a href="#" className="text-xs text-gray-600 hover:text-gray-400">
              服务条款
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── 首页 ──────────────────────────────────────────
export default function HomePage() {
  return (
    <main className="bg-[#0a0a15] min-h-screen">
      <NavBar />
      <HeroSection />
      <StatsSection />
      <ProductsSection />
      <WhySection />
      <SolutionsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
