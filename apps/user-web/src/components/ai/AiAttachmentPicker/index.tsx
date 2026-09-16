import { InboxOutlined } from '@ant-design/icons';
import { Button, Drawer, Empty } from 'antd';
import React, { useState } from 'react';

export interface AiAttachmentItem {
  id: string;
  name: string;
  typeLabel: string;
  sizeLabel: string;
}

interface AiAttachmentPickerProps {
  selectedIds: string[];
  onSelect: (item: AiAttachmentItem) => void;
}

/**
 * 附件选择器。本阶段上传尚未接入，明确展示待接入而不是内置假文件。
 */
const AiAttachmentPicker: React.FC<AiAttachmentPickerProps> = ({
  selectedIds,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  void selectedIds;
  void onSelect;

  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        上传附件
      </Button>
      <Drawer
        destroyOnHidden
        open={open}
        size="default"
        title="选择附件"
        onClose={() => setOpen(false)}
      >
        <Empty
          description="附件上传待接入。当前不会写入假文件。"
          image={<InboxOutlined />}
        />
      </Drawer>
    </>
  );
};

export default AiAttachmentPicker;
