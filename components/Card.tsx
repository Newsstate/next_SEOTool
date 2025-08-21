import React from "react";
export default function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white shadow rounded-2xl p-4">
      <details className="group">
        <summary className="cursor-pointer flex items-center justify-between">
          <span className="font-semibold text-gray-800">{title}</span>
          <span className="text-gray-400 transition group-open:rotate-180">&#9662;</span>
        </summary>
        <div className="mt-3 text-sm text-gray-700">{children}</div>
      </details>
    </div>
  );
}
