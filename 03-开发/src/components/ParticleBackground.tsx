"use client";

import { useEffect, useRef } from "react";

/**
 * 粒子网络背景组件
 * 基于 particles.js (Canvas 2D)，用于登录页左侧品牌区
 */
export function ParticleBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;

    // 动态加载 particles.js
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pJS = (window as any).particlesJS;
      if (!pJS || !containerRef.current) return;

      pJS(containerRef.current.id, {
        particles: {
          number: {
            value: 70,
            density: { enable: true, value_area: 800 },
          },
          color: { value: ["#ffffff", "#66b3ff", "#3399ff"] },
          shape: { type: "circle" },
          opacity: {
            value: 0.7,
            random: true,
            anim: {
              enable: true,
              speed: 0.8,
              opacity_min: 0.3,
              sync: false,
            },
          },
          size: {
            value: 2.5,
            random: true,
            anim: {
              enable: true,
              speed: 1.5,
              size_min: 0.5,
              sync: false,
            },
          },
          line_linked: {
            enable: true,
            distance: 150,
            color: "#66b3ff",
            opacity: 0.2,
            width: 1,
          },
          move: {
            enable: true,
            speed: 0.8,
            direction: "none",
            random: false,
            straight: false,
            out_mode: "out",
            bounce: false,
          },
        },
        interactivity: {
          detect_on: "canvas",
          events: {
            onhover: { enable: true, mode: "grab" },
            onclick: { enable: false },
            resize: true,
          },
          modes: {
            grab: { distance: 180, line_linked: { opacity: 0.5 } },
          },
        },
        retina_detect: true,
      });
    };
    document.head.appendChild(script);

    return () => {
      // 清理: 移除 particles.js 画布
      const canvases = containerRef.current?.querySelectorAll("canvas");
      canvases?.forEach((c) => c.remove());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="particles-bg"
      className="absolute inset-0"
    />
  );
}
