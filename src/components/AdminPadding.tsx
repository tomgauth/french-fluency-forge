import { useAdminMode } from '@/hooks/useAdminMode';

/**
 * Wrapper component to add padding for admin toolbar
 * Use this to wrap pages that need space for the admin toolbar
 */

interface AdminPaddingProps {
  children: React.ReactNode;
  className?: string;
}

export function AdminPadding({ children, className = '' }: AdminPaddingProps) {
  const { showDevTools } = useAdminMode();

  return (
    <div className={`${showDevTools ? 'pt-20' : ''} ${className}`}>
      {children}
    </div>
  );
}

