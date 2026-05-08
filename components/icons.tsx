import React from 'react';

// fix: Define IconProps to be used by all icon components.
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
}

// fix: Add missing ArchiveIcon component.
export const ArchiveIcon: React.FC<IconProps> = ({ width = 20, height = 20, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="1" y="3" width="22" height="5" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
    </svg>
);

// fix: Add missing DownloadIcon component.
export const DownloadIcon: React.FC<IconProps> = ({ width = 16, height = 16, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

// fix: Add missing EditIcon component.
export const EditIcon: React.FC<IconProps> = ({ width = 16, height = 16, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

// fix: Add missing HistoryIcon component.
export const HistoryIcon: React.FC<IconProps> = ({ width = 24, height = 24, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l4 2" />
    </svg>
);

// fix: Add missing IsolateIcon component.
export const IsolateIcon: React.FC<IconProps> = ({ width = 16, height = 16, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m4.93 19.07 1.41-1.41" />
        <path d="m17.66 6.34 1.41-1.41" />
    </svg>
);

// fix: Add missing ReloadIcon component.
export const ReloadIcon: React.FC<IconProps> = ({ width = 16, height = 16, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
        <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
);

// fix: Add missing RevertIcon component.
export const RevertIcon: React.FC<IconProps> = ({ width = 20, height = 20, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="9 14 4 9 9 4"></polyline>
        <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
    </svg>
);

// fix: Add missing SparklesIcon component.
export const SparklesIcon: React.FC<IconProps> = ({ width = 24, height = 24, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="currentColor"
        {...props}
    >
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
);

// fix: Add missing UploadIcon component.
export const UploadIcon: React.FC<IconProps> = ({ width = 16, height = 16, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

// fix: Add missing XIcon component.
export const XIcon: React.FC<IconProps> = ({ width = 24, height = 24, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

// Adicionado no final do arquivo
export const SettingsIcon: React.FC<IconProps> = ({ width = 24, height = 24, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

export const FolderOpenIcon: React.FC<IconProps> = ({ width = 24, height = 24, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
    </svg>
);

export const TextAnalysisIcon: React.FC<IconProps> = ({ width = 16, height = 16, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m10.5 13.5 2 2" />
        <path d="m21 21-6.5-6.5" />
        <path d="M3 10v3c0 .6.4 1 1 1h.5c.3 0 .5-.2.5-.5v-4c0-.3-.2-.5-.5-.5H4c-.6 0-1 .4-1 1z" />
        <path d="M5 8V7c0-.6.4-1 1-1h1.5c.3 0 .5.2.5.5v0c0 .3-.2.5-.5.5H6" />
        <path d="M14 6c.6 0 1 .4 1 1v1.5c0 .3-.2.5-.5.5h0c-.3 0-.5-.2-.5-.5V7" />
        <path d="M15 14v-2.5c0-.3-.2-.5-.5-.5H14" />
        <path d="M10 6.5v-1c0-.3.2-.5.5-.5H11" />
        <path d="M10.5 15.5c0 .3.2.5.5.5h.5c.6 0 1-.4 1-1v-1" />
    </svg>
);

export const CropIcon: React.FC<IconProps> = ({ width = 16, height = 16, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
        <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
    </svg>
);
