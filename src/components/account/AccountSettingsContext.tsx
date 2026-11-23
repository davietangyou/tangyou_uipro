import {createContext, type ReactNode} from 'react';

export const AccountSettingsContext = createContext<{syncFeedback:ReactNode;logoutAction:ReactNode}|null>(null);
