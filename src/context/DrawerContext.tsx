/**
 * DrawerContext — extracted to a standalone file to break the circular
 * dependency:  AppNavigator → (screen) → DrawerMenuButton → AppNavigator
 *
 * Both AppNavigator and DrawerMenuButton import from HERE, so there is no
 * longer a cycle.
 */
import { createContext, useContext } from 'react';

export interface DrawerContextType {
  openDrawer: () => void;
  closeDrawer: () => void;
  isOpen: boolean;
}

export const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isOpen: false,
});

export const useDrawer = () => useContext(DrawerContext);
