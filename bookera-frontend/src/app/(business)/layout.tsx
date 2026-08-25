import React from 'react';

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}