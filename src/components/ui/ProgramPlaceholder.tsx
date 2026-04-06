import type { LucideIcon } from 'lucide-react';

interface ProgramPlaceholderProps {
  title: string;
  message?: string;
  icon: LucideIcon;
}

export default function ProgramPlaceholder({
  title,
  message = 'Deze pagina is klaar voor verdere invulling.',
  icon: Icon,
}: ProgramPlaceholderProps) {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Icon size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">{title}</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-dc-gray-100 p-6">
        <p className="text-sm text-dc-gray-500">{message}</p>
      </div>
    </div>
  );
}
