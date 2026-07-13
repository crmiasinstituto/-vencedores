import React from 'react';
import { ActiveCallModal } from './ActiveCallModal';
import { IncomingCallModal } from './IncomingCallModal';
import { CallEndedModal } from './CallEndedModal';
import { ActiveCallIndicator } from './ActiveCallIndicator';

export const CallModals: React.FC = () => {
  return (
    <>
      <IncomingCallModal />
      <ActiveCallModal />
      <CallEndedModal />
      <ActiveCallIndicator />
    </>
  );
};
