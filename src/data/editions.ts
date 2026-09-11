export type EditionId = 'community' | 'team' | 'saas' | 'enterprise';
export interface Edition { id: EditionId; featureKeys: string[] }
export const editions: Edition[] = [
  { id: 'community', featureKeys: ['ed.multiProvider', 'ed.usageReports'] },
  { id: 'team', featureKeys: ['ed.multiProvider', 'ed.usageReports', 'ed.teamManagement', 'ed.quota'] },
  { id: 'saas', featureKeys: ['ed.multiProvider', 'ed.usageReports', 'ed.teamManagement', 'ed.quota', 'ed.hosted'] },
  { id: 'enterprise', featureKeys: ['ed.multiProvider', 'ed.usageReports', 'ed.teamManagement', 'ed.quota', 'ed.hosted', 'ed.support'] },
];
export const capabilityKeys = ['ed.multiProvider', 'ed.usageReports', 'ed.teamManagement', 'ed.quota', 'ed.hosted', 'ed.support'] as const;
