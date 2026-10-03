import {WorkspaceGate} from '@/components/platform/provider';
import {Companion} from '@/components/companion';
import {TextSizeSync} from '@/components/platform/text-size';
export default function DashboardLayout({children}:{children:React.ReactNode}){return <WorkspaceGate><TextSizeSync/>{children}<Companion/></WorkspaceGate>}
