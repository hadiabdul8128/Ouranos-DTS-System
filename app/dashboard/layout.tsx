import {WorkspaceGate} from '@/components/platform/provider';
export default function DashboardLayout({children}:{children:React.ReactNode}){return <WorkspaceGate>{children}</WorkspaceGate>}
