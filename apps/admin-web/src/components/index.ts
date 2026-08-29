/**
 * 组件统一出口
 */
import Footer from './Footer';
import { AvatarDropdown } from './RightContent/AvatarDropdown';
import RightContent from './RightContent/RightContent';

export { default as ErrorBoundary } from './ErrorBoundary';
export { default as HeaderDropdown } from './HeaderDropdown';
export { default as OfflineBanner } from './OfflineBanner';
export { AvatarDropdown, Footer, RightContent };
