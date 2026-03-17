import { createContext, useContext } from 'react';

import { NOOP_STATE, useOtaUpdates } from './hooks/useOtaUpdates';

import type { OtaUpdateState } from './hooks/useOtaUpdates';

const OtaUpdatesContext = createContext<OtaUpdateState>(NOOP_STATE);

export function OtaUpdatesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = useOtaUpdates();
  return (
    <OtaUpdatesContext.Provider value={state}>
      {children}
    </OtaUpdatesContext.Provider>
  );
}

export function useOtaUpdateStatus(): OtaUpdateState {
  return useContext(OtaUpdatesContext);
}
