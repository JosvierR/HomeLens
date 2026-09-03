import { InMemoryEvidenceRepository } from '~~/shared/evidence-repository'
import { demoEvidence } from '../data/demo-evidence'

const globalEvidence = globalThis as typeof globalThis & {
  __homeLensEvidenceRepository?: InMemoryEvidenceRepository
}

export const getEvidenceRepository = () => {
  globalEvidence.__homeLensEvidenceRepository ??= new InMemoryEvidenceRepository(demoEvidence)
  return globalEvidence.__homeLensEvidenceRepository
}
