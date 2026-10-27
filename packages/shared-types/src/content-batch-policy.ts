import { type ContentItem, ContentVisibility } from './content';

export type BatchVisibility = ContentVisibility | 'KEEP';

type BatchContent = Pick<ContentItem, 'visibility' | 'importRestriction'>;

/** 逐项判断导入版权闸；保持原可见性时不能用整批的统一值代替。 */
export function needsBatchCopyrightNote(item: BatchContent, target: BatchVisibility): boolean {
  const visibility = target === 'KEEP' ? (item.visibility ?? ContentVisibility.Private) : target;
  return item.importRestriction === 'PRIVATE_UNTIL_LICENSED' && visibility !== ContentVisibility.Private;
}

/** 只给需要清除版权闸的项目附授权依据；不改动各项目原有来源说明。 */
export function batchPublishOptions(
  item: BatchContent,
  target: BatchVisibility,
  copyrightNote?: string,
): { requestedVisibility?: ContentVisibility; copyrightNote?: string } {
  return {
    ...(target === 'KEEP' ? {} : { requestedVisibility: target }),
    ...(needsBatchCopyrightNote(item, target) && copyrightNote?.trim()
      ? { copyrightNote: copyrightNote.trim() }
      : {}),
  };
}
