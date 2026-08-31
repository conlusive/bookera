import React from 'react';

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#222222] selection:bg-[#C2D8C4] selection:text-[#111827]">
      <main className="flex-1 bg-white">{children}</main>
    </div>
  );
}