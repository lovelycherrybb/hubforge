import Link from "next/link";

export const metadata = {
  title: "关于我们 — 华检科 HubForge",
  description:
    "华设检测科技有限公司，源自江苏省交通规划设计院检测中心，专注质量安全检测领域的AI数字化转型。",
};

export default function AboutPage() {
  return (
    <main className="bg-[#0a0a15] min-h-screen text-white">
      {/* 导航 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a15]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="华检科"
              className="w-8 h-8 rounded object-cover"
            />
            <span className="font-bold text-white tracking-tight">
              华检科 HubForge
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            返回首页
          </Link>
        </div>
      </nav>

      <div className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6">
          {/* 公司简介 */}
          <section className="mb-20">
            <h1 className="text-3xl md:text-4xl font-bold mb-8">
              关于华检科
            </h1>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                华设检测科技有限公司（简称"华检科"）源自江苏省交通规划设计院检测中心，是华设设计集团股份有限公司旗下专业检测技术服务机构。
              </p>
              <p>
                从最初的交通规划设计院内部检测部门，到独立运营的第三方检测机构，再到如今的AI数字化转型先锋，华检科见证了中国交通检测行业从手工记录到智能化的完整演变。
              </p>
              <p>
                公司总部位于南京，依托华设设计集团（上市公司，股票代码：603018）的技术积累和行业资源，专注为交通、建筑、水利、环境等领域提供质量安全检测技术服务。
              </p>
            </div>
          </section>

          {/* 发展历程 */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-8">发展历程</h2>
            <div className="space-y-8">
              {[
                {
                  year: "1966",
                  event:
                    "江苏省交通规划设计院成立，设立内部检测中心，承担交通工程检测任务",
                },
                {
                  year: "1998",
                  event:
                    "检测中心获得CMA计量认证，具备独立出具检测报告资质",
                },
                {
                  year: "2003",
                  event:
                    "江苏省交通规划设计院改制为华设设计集团，检测中心纳入集团体系",
                },
                {
                  year: "2014",
                  event:
                    "华设设计集团在上交所上市（603018），检测业务迎来快速发展期",
                },
                {
                  year: "2018",
                  event:
                    "检测中心独立注册为华设检测科技有限公司，开启市场化运营",
                },
                {
                  year: "2020",
                  event:
                    "获得CNAS实验室认可，检测报告获得国际互认资质",
                },
                {
                  year: "2023",
                  event:
                    "启动AI数字化转型战略，探索将人工智能技术应用于检测全流程",
                },
                {
                  year: "2026",
                  event:
                    "HubForge多租户应用门户平台上线，9大AI产品矩阵形成",
                },
              ].map((item) => (
                <div key={item.year} className="flex gap-6">
                  <div className="text-2xl font-bold text-[#4a9eff] w-16 shrink-0">
                    {item.year}
                  </div>
                  <div className="text-gray-300 pt-1">{item.event}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 资质认证 */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-8">资质认证</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  name: "CMA 计量认证",
                  desc: "中国计量认证，检测报告具有法律效力",
                },
                {
                  name: "CNAS 实验室认可",
                  desc: "检测报告获得国际互认",
                },
                {
                  name: "ISO 9001",
                  desc: "质量管理体系认证",
                },
                {
                  name: "ISO 14001",
                  desc: "环境管理体系认证",
                },
              ].map((cert) => (
                <div
                  key={cert.name}
                  className="p-4 rounded-xl border border-white/5 bg-white/[0.02]"
                >
                  <div className="text-sm font-medium text-white mb-2">
                    {cert.name}
                  </div>
                  <div className="text-xs text-gray-500">{cert.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 技术实力 */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-8">技术实力</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "60年技术积淀",
                  desc: "从1966年至今，历经60年交通检测技术积累，参与编制多项行业标准",
                },
                {
                  title: "高级工程师团队",
                  desc: "多名高级工程师和技术专家，多人参与国家/行业标准制定",
                },
                {
                  title: "产学研合作",
                  desc: "与东南大学、河海大学等高校建立长期合作关系，持续技术创新",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-6 rounded-xl border border-white/5 bg-white/[0.02]"
                >
                  <h3 className="text-lg font-semibold text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 业务领域 */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-8">业务领域</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                "交通工程检测",
                "建筑工程质量",
                "环境监测",
                "水利水电工程",
                "材料检测",
                "道路桥梁检测",
                "隧道检测",
                "安全设施检测",
              ].map((field) => (
                <div
                  key={field}
                  className="p-3 rounded-lg border border-white/5 bg-white/[0.02] text-center"
                >
                  <div className="text-sm text-gray-300">{field}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 母公司 */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold mb-8">母公司</h2>
            <div className="p-6 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-lg font-semibold text-white mb-4">
                华设设计集团股份有限公司
              </h3>
              <div className="space-y-3 text-sm text-gray-400">
                <p>股票代码：603018（上海证券交易所）</p>
                <p>
                  华设集团是中国领先的交通设计咨询企业，业务涵盖公路、水运、市政、建筑等领域的规划、设计、咨询、检测服务。
                </p>
                <p>
                  作为华设集团旗下专业检测机构，华检科依托集团的技术资源和行业网络，为客户提供全方位的检测技术服务。
                </p>
              </div>
            </div>
          </section>

          {/* 企业使命 */}
          <section className="text-center py-16 border-t border-white/5">
            <blockquote className="text-2xl md:text-3xl font-light text-gray-300 italic mb-4">
              "让每一个检测动作都变成数据资产"
            </blockquote>
            <p className="text-gray-500">
              以AI重塑质量安全咨询解决方案
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
