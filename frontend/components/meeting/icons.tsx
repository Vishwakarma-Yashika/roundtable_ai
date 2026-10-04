import type { ReactNode } from "react";

function Icon({ children, className = "h-4 w-4" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export const MicIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="9" y="2.5" width="6" height="12" rx="3" />
    <path d="M18.5 10.5v.5a6.5 6.5 0 0 1-13 0v-.5" />
    <path d="M12 17.5V21" />
  </Icon>
);

export const StopIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
  </Icon>
);

export const SendIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M12 19V5" />
    <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
  </Icon>
);

export const PlusIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
);

export const BoltIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />
  </Icon>
);

export const LeaveIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M9 20.5H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2H9" />
    <path d="m15.5 16.5 4.5-4.5-4.5-4.5" />
    <path d="M20 12H9" />
  </Icon>
);

export const ClockIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const CloseIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Icon>
);

export const ArrowDownIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M12 5v14" />
    <path d="m18.5 12.5-6.5 6.5-6.5-6.5" />
  </Icon>
);

export const ReplyIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M9 14 4.5 9.5 9 5" />
    <path d="M4.5 9.5H14a5.5 5.5 0 0 1 5.5 5.5v4" />
  </Icon>
);
