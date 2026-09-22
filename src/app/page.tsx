'use client'

import { useRoadmapStore } from '@/store/useRoadmapStore'
import { useRoadmapPersistence } from '@/lib/persistence/useRoadmapPersistence'
import { useUndoShortcuts } from '@/lib/history/useUndoShortcuts'
import Toolbar from '@/components/Toolbar'
import LeftRail from '@/components/LeftRail'
import RightPanel from '@/components/RightPanel'
import Toast from '@/components/Toast'
import FilterBar from '@/components/FilterBar'
import ImpactModal from '@/components/modals/ImpactModal'
import ProjectModal from '@/components/modals/ProjectModal'
import ResourceModal from '@/components/modals/ResourceModal'
import ScenarioModal from '@/components/modals/ScenarioModal'
import HistoryModal from '@/components/modals/HistoryModal'
import AnalysisModal from '@/components/modals/AnalysisModal'
import SprintModal from '@/components/modals/SprintModal'
import TimelineView from '@/components/views/TimelineView'
import CrossView from '@/components/views/CrossView'
import ResourcesView from '@/components/views/ResourcesView'
import CostsView from '@/components/views/CostsView'
import CompareView from '@/components/views/CompareView'
import SettingsView from '@/components/views/SettingsView'

export default function Home() {
  useRoadmapPersistence()
  useUndoShortcuts()
  const view = useRoadmapStore(s => s.view)
  const isSettings = view === 'settings'

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Toolbar />
      {!isSettings && <FilterBar />}
      <div className="flex-1 min-h-0 flex relative">
        {!isSettings && <LeftRail />}
        <div className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
          {view === 'timeline' && <TimelineView />}
          {view === 'cross' && <CrossView />}
          {view === 'resources' && <ResourcesView />}
          {view === 'costs' && <CostsView />}
          {view === 'compare' && <CompareView />}
          {view === 'settings' && <SettingsView />}
          {!isSettings && <RightPanel />}
          <Toast />
        </div>
      </div>
      <ImpactModal />
      <ProjectModal />
      <ResourceModal />
      <ScenarioModal />
      <HistoryModal />
      <AnalysisModal />
      <SprintModal />
    </div>
  )
}
