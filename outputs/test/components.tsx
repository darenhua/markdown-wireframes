"use client";

import * as React from "react";

export function Button({
  label,
  variant = "default",
  onClick,
}: {
  label: string;
  variant?: "primary" | "secondary" | "default";
  onClick?: () => void;
}) {
  const baseClasses =
    "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500",
    default: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function Text({ text }: { text: string }) {
  return <p className="text-gray-300">{text}</p>;
}
