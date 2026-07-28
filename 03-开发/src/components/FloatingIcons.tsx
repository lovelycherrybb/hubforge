"use client";

/**
 * 交通+质量安全图标漂浮层
 * 半透明 SVG 图标叠加在粒子背景上，缓慢漂浮
 */
export function FloatingIcons() {
  return (
    <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
      {/* 安全帽 - 左上 */}
      <svg
        className="absolute opacity-[0.06] animate-float-slow"
        style={{ top: "15%", left: "8%", width: 80, height: 80 }}
        viewBox="0 0 64 64"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 安全帽主体 */}
        <path d="M12 40 C12 24 20 14 32 14 C44 14 52 24 52 40" />
        {/* 帽檐 */}
        <path d="M8 40 L56 40" />
        <path d="M10 40 C10 44 14 46 18 46 L46 46 C50 46 54 44 54 40" />
        {/* 帽顶十字 */}
        <line x1="32" y1="18" x2="32" y2="30" />
        <line x1="26" y1="24" x2="38" y2="24" />
      </svg>

      {/* 桥梁 - 右上 */}
      <svg
        className="absolute opacity-[0.05] animate-float-slow-reverse"
        style={{ top: "8%", right: "10%", width: 120, height: 60 }}
        viewBox="0 0 120 60"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 桥面 */}
        <path d="M0 35 L120 35" />
        {/* 桥拱 */}
        <path d="M15 35 Q37 8 60 35" />
        <path d="M60 35 Q83 8 105 35" />
        {/* 桥墩 */}
        <line x1="37" y1="35" x2="37" y2="55" />
        <line x1="83" y1="35" x2="83" y2="55" />
        {/* 桥塔 */}
        <line x1="37" y1="35" x2="37" y2="12" />
        <line x1="83" y1="35" x2="83" y2="12" />
        {/* 拉索 */}
        <line x1="37" y1="12" x2="60" y2="35" />
        <line x1="83" y1="12" x2="60" y2="35" />
      </svg>

      {/* 安全盾牌 - 左中 */}
      <svg
        className="absolute opacity-[0.05] animate-float-medium"
        style={{ top: "45%", left: "5%", width: 70, height: 80 }}
        viewBox="0 0 56 64"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 盾牌轮廓 */}
        <path d="M28 4 L50 14 L50 30 C50 46 28 60 28 60 C28 60 6 46 6 30 L6 14 Z" />
        {/* 对勾 */}
        <path d="M18 32 L25 40 L38 26" />
      </svg>

      {/* 高速公路标志 - 右下 */}
      <svg
        className="absolute opacity-[0.05] animate-float-medium-reverse"
        style={{ bottom: "20%", right: "8%", width: 70, height: 70 }}
        viewBox="0 0 64 64"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 路牌 */}
        <rect x="8" y="8" width="48" height="32" rx="4" />
        {/* 路牌支柱 */}
        <line x1="32" y1="40" x2="32" y2="56" />
        {/* 箭头 */}
        <path d="M20 24 L44 24" />
        <path d="M38 18 L44 24 L38 30" />
        {/* 速度数字 */}
        <text x="32" y="22" textAnchor="middle" fill="white" fontSize="8" stroke="none" fontFamily="sans-serif">
          G25
        </text>
      </svg>

      {/* 警告三角 - 底部 */}
      <svg
        className="absolute opacity-[0.04] animate-float-slow"
        style={{ bottom: "10%", left: "30%", width: 60, height: 55 }}
        viewBox="0 0 64 56"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 三角形 */}
        <path d="M32 4 L60 52 L4 52 Z" />
        {/* 感叹号 */}
        <line x1="32" y1="20" x2="32" y2="36" />
        <circle cx="32" cy="42" r="2" fill="white" />
      </svg>
    </div>
  );
}
