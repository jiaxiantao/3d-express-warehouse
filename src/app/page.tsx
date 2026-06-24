"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 主入口直接进入 3D 仓库控制台（兼容 GitHub Pages 静态导出） */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/warehouse");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020617] text-sm text-slate-400">
      正在进入 3D 仓库…
    </main>
  );
}
