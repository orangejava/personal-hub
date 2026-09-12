import { useModel } from '@umijs/max';
import React from 'react';
import UserAccountPopover from '@/components/shared/UserAccountPopover';

type AvatarDropdownProps = {
  children?: React.ReactNode;
};

export const AvatarDropdown: React.FC<AvatarDropdownProps> = ({ children }) => {
  const { initialState } = useModel('@@initialState');
  if (!initialState?.currentUser) {
    return children ?? null;
  }
  return <UserAccountPopover variant="base">{children}</UserAccountPopover>;
};
