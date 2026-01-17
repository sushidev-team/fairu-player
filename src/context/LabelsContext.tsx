import React, { createContext, useContext, useMemo } from 'react';
import { defaultLabels, type PlayerLabels, type PartialLabels } from '@/types/labels';

const LabelsContext = createContext<PlayerLabels>(defaultLabels);

export interface LabelsProviderProps {
  children: React.ReactNode;
  labels?: PartialLabels;
}

/**
 * Provider for player labels (text localization)
 */
export function LabelsProvider({ children, labels }: LabelsProviderProps) {
  const mergedLabels = useMemo(() => ({ ...defaultLabels, ...labels }), [labels]);
  return <LabelsContext.Provider value={mergedLabels}>{children}</LabelsContext.Provider>;
}

/**
 * Hook to access player labels
 */
export function useLabels(): PlayerLabels {
  return useContext(LabelsContext);
}

export { LabelsContext };
