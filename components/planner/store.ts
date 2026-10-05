'use client';
import {usePlatform} from '@/components/platform/provider';
import {usePersonalState} from '@/components/platform/personal-state';
import type {Checklist,PlannerItem} from '@/packages/domain/planner';
import type {TripPayment} from '@/packages/domain/trip-history';

/** Appointments, deadlines and legacy data, synchronized privately per account and workspace. */
export type PlannerState={items:PlannerItem[];checklists:Checklist[];payments:Record<string,TripPayment>};
const EMPTY:PlannerState={items:[],checklists:[],payments:{}};
export function usePlanner(){
 const p=usePlatform();
 const legacy=`ouranos.planner.v1.${p.session?.user.id??'local'}.${p.organizationId??'none'}`;
 return usePersonalState<PlannerState>('planner',EMPTY,[legacy]);
}
