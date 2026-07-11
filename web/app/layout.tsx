import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ColorBridge 色译通",
  description: "纺织印染调色协同工作台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "Inter, system-ui, -apple-system, sans-serif", background: "#f0f4f5" }}>
        {children}
      </body>
    </html>
  );
}
