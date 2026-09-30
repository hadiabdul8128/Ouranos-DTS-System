import {WorkspaceGate} from '@/components/platform/provider';
import {Companion} from '@/components/companion';
export default function DashboardLayout({children}:{children:React.ReactNode}){return <WorkspaceGate>{children}<Companion/></WorkspaceGate>}
