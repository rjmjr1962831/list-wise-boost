interface SandboxNuggetProps {
  children: React.ReactNode;
}

export function SandboxNugget({ children }: SandboxNuggetProps) {
  return (
    <div className="border-l-4 border-r-4 border-primary bg-primary/5 rounded-lg px-4 py-3 text-sm text-foreground/80 mb-6">
      {children}
    </div>
  );
}
