import React from 'react';

interface BusinessCardProps {
  name: string;
  address: string;
  slug: string;
}

export default function BusinessCard({ name, address, slug }: BusinessCardProps) {
  return (
    <div className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all bg-white">
      <div className="h-40 bg-slate-100 rounded-lg mb-4 flex items-center justify-center text-slate-400">
        Фото салону
      </div>
      <h3 className="text-lg font-bold text-slate-900">{name}</h3>
      <p className="text-slate-500 text-sm mb-4">{address}</p>
      <a
        href={`/business/${slug}`}
        className="block w-full bg-slate-900 text-white text-center py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
      >
        Забронювати
      </a>
    </div>
  );
}