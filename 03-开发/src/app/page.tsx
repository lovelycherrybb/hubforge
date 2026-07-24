export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">HubForge</h1>
      <p className="text-xl text-muted-foreground">企业应用管理平台</p>
      <div className="mt-8 flex gap-4">
        <a
          href="/login"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition"
        >
          登录
        </a>
        <a
          href="/register"
          className="px-6 py-2 border border-primary text-primary rounded-md hover:opacity-90 transition"
        >
          注册
        </a>
      </div>
    </main>
  );
}
