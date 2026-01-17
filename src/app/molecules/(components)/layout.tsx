import Link from "next/link";

export default function MoleculesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen">
      <div className="border-b p-4 shrink-0">
        <Link
          className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
          href="/atoms"
        >
          <span>&larr;</span>
          <span>Back to Atoms</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
