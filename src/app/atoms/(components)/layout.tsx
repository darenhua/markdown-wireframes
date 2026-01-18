import Link from "next/link";

export default function AtomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* <div className="border-b p-4">
        <Link
          className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
          href="/atoms"
        >
          <span>&larr;</span>
          <span>Back to Atoms</span>
        </Link>
      </div> */}
      {children}
    </div>
  );
}
