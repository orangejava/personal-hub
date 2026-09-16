/**
 * 全站列表分页默认。
 * 不要写死 pageSize：ProTable 每次渲染都会用它覆盖内部状态，改「每页条数」会弹回。
 * 初始条数靠 defaultPageSize；库在未传 pagination 时才回落到 20。
 */
export const DEFAULT_TABLE_PAGE_SIZE = 10;

export const TABLE_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

/** 总数文案统一，避免 ProTable 英文 locale 和裸 Pagination 各写一套。 */
export function formatTableTotal(total: number, range: [number, number]): string {
  return `${range[0]}-${range[1]} / ${total}`;
}

export const DEFAULT_TABLE_PAGINATION = {
  defaultCurrent: 1,
  defaultPageSize: DEFAULT_TABLE_PAGE_SIZE,
  showSizeChanger: true,
  showQuickJumper: true,
  hideOnSinglePage: false,
  align: 'end' as const,
  pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
  showTotal: formatTableTotal,
};

/**
 * 筛选项超过一行时 QueryFilter 默认折叠。
 * defaultFormItemsNumber 避免只露出查询按钮、字段被收进「展开」。
 */
export const DEFAULT_TABLE_SEARCH = {
  labelWidth: 'auto' as const,
  defaultCollapsed: false,
  defaultFormItemsNumber: 12,
};
