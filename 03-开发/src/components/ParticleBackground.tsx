"use client";

import { useEffect, useRef } from "react";

/**
 * 星空纵深 + 打字机效果
 * star-field 背景 + 中间 typewriter 文字
 */
export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.offsetWidth * 2;
      canvas.height = parent.offsetHeight * 2;
      canvas.style.width = parent.offsetWidth + "px";
      canvas.style.height = parent.offsetHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    // ── 星空粒子 ──
    const stars: { x: number; y: number; z: number }[] = [];
    const starCount = 500;
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width - canvas.width / 2,
        y: Math.random() * canvas.height - canvas.height / 2,
        z: Math.random() * canvas.width,
      });
    }

    // ── 打字机状态 ──
    const texts = [
      "AI 重塑咨询解决方案",
      "质量安全解决方案AI专家",
    ];
    let textIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let lastTypeTime = 0;
    const typeSpeed = 120; // ms per char
    const deleteSpeed = 60;
    const pauseTime = 4000; // 打完后多停一会儿

    // ── 性能检测：前 120 帧，任何一帧超过 20ms(~50fps) 就关闭所有动效 ──
    let frameCount = 0;
    let lastFrameTime = 0;
    let showEffects = true;

    function draw(time: number) {
      if (!canvas || !ctx) return;

      // 性能检测：逐帧检测，任何一帧卡顿就关闭所有动效
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

      // ── 绘制星空（性能差时跳过） ──
      if (showEffects) {
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
            // 尾迹
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

            // 星点
            ctx.fillStyle = `rgba(200,225,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();

            // 中心亮星
            if (r > 2) {
              ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
              ctx.beginPath();
              ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // ── Mesh Gradient 层（活泼多色，性能差时跳过） ──
      if (showEffects) {
        ctx.globalCompositeOperation = "lighter";
      const blobs = [
        { x: w * 0.2, y: h * 0.3, r: w * 0.3, color: [60, 20, 180] },    // 靛蓝
        { x: w * 0.75, y: h * 0.15, r: w * 0.28, color: [20, 140, 255] },  // 亮蓝
        { x: w * 0.5, y: h * 0.7, r: w * 0.32, color: [160, 40, 200] },   // 品紫
        { x: w * 0.85, y: h * 0.75, r: w * 0.25, color: [0, 200, 200] },   // 青
        { x: w * 0.1, y: h * 0.85, r: w * 0.22, color: [200, 50, 120] },   // 玫红
      ];
      const t0 = time * 0.001;
      blobs.forEach((b, i) => {
        // 多频率叠加，产生非线性有机运动
        const phase = i * 1.7;
        const ox = (Math.sin(t0 * 1.3 + phase) * 0.5
                   + Math.sin(t0 * 0.7 + phase * 2.3) * 0.3
                   + Math.sin(t0 * 2.1 + phase * 0.5) * 0.2) * w * 0.15;
        const oy = (Math.cos(t0 * 0.9 + phase * 1.5) * 0.5
                   + Math.cos(t0 * 1.8 + phase * 0.8) * 0.3
                   + Math.cos(t0 * 0.4 + phase * 2.7) * 0.2) * h * 0.15;

        // 颜色也随时间流动变化
        const cr = b.color[0] + Math.sin(t0 * 0.8 + i * 2) * 60;
        const cg = b.color[1] + Math.sin(t0 * 1.1 + i * 3) * 50;
        const cb = b.color[2] + Math.cos(t0 * 0.6 + i * 1.5) * 60;

        const g = ctx.createRadialGradient(b.x + ox, b.y + oy, 0, b.x + ox, b.y + oy, b.r);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},0.22)`);
        g.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.08)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }); // end blobs.forEach
      ctx.globalCompositeOperation = "source-over";
      } // end if showEffects

      // ── 绘制打字机文字 ──
      const currentText = texts[textIdx];
      const elapsed = time - lastTypeTime;

      if (!deleting && elapsed > typeSpeed) {
        charIdx++;
        lastTypeTime = time;
        if (charIdx > currentText.length) {
          charIdx = currentText.length;
          deleting = true;
          lastTypeTime = time + pauseTime; // 等待
        }
      } else if (deleting && elapsed > deleteSpeed) {
        charIdx--;
        lastTypeTime = time;
        if (charIdx < 0) {
          charIdx = 0;
          deleting = false;
          textIdx = (textIdx + 1) % texts.length;
          lastTypeTime = time;
        }
      }

      const displayText = currentText.slice(0, charIdx);

      // 文字样式
      const fontSize = Math.min(w * 0.032, 30);
      ctx.font = `300 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 文字发光
      ctx.shadowColor = "rgba(74,158,255,0.4)";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(displayText, w / 2, h / 2);
      ctx.shadowBlur = 0;

      // 光标
      const cursorVisible = Math.sin(time * 0.005) > 0;
      if (cursorVisible) {
        const textWidth = ctx.measureText(displayText).width;
        const cursorX = w / 2 + textWidth / 2 + 6;
        ctx.fillStyle = "rgba(74,158,255,0.4)";
        ctx.fillRect(cursorX, h / 2 - fontSize * 0.4, 3, fontSize * 0.8);
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
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
    />
  );
}
