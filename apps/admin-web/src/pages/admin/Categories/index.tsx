import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
import type { CategoryMutationInput, CategoryRecord } from '@personal-hub/shared-types';
import { PageContainer, ResultState } from '@/components/shared';
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from '@/services/admin';

type CategoryTreeRecord = CategoryRecord & { children?: CategoryTreeRecord[] };

function toTree(categories: CategoryRecord[]): CategoryTreeRecord[] {
  const map = new Map<string, CategoryTreeRecord>();
  for (const item of categories) map.set(item.id, { ...item, children: [] });
  const roots: CategoryTreeRecord[] = [];
  for (const item of map.values()) {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)?.children?.push(item);
    } else {
      roots.push(item);
    }
  }
  const sortTree = (items: CategoryTreeRecord[]): CategoryTreeRecord[] =>
    items
      .sort((a, b) => a.sort - b.sort)
      .map((item) => ({
        ...item,
        children: item.children?.length ? sortTree(item.children) : undefined,
      }));
  return sortTree(roots);
}

/** 分类管理：树形 CRUD + 子级/内容引用删除校验。 */
const Categories: React.FC = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [creatingParent, setCreatingParent] = useState<CategoryRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string>();

  const parentOptions = useMemo(
    () =>
      categories.map((item) => ({
        label: `${item.name} (${item.slug})`,
        value: item.id,
        disabled: editing?.id === item.id,
      })),
    [categories, editing],
  );

  const submit = async (values: CategoryMutationInput) => {
    const payload = {
      ...values,
      parentId: values.parentId || creatingParent?.id || undefined,
    };
    if (editing) {
      await updateAdminCategory(editing.id, payload);
    } else {
      await createAdminCategory(payload);
    }
    message.success(editing ? '分类已更新' : '分类已创建');
    setEditing(null);
    setCreatingParent(null);
    setReloadKey((key) => key + 1);
    return true;
  };

  return (
    <PageContainer
      title="分类管理"
      extra={
        <Button type="primary" onClick={() => setCreatingParent({} as CategoryRecord)}>
          新建一级分类
        </Button>
      }
    >
      <ProTable<CategoryRecord>
        key={reloadKey}
        rowKey="id"
        search={false}
        pagination={false}
        locale={{
          emptyText: <ResultState status="empty" description="暂无分类" />,
        }}
        expandable={{ defaultExpandAllRows: true }}
        request={async () => {
          const res = await fetchAdminCategories();
          const list = res ?? [];
          setCategories(list);
          return { data: toTree(list), success: true };
        }}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: 'Slug', dataIndex: 'slug' },
          { title: '排序', dataIndex: 'sort', width: 90 },
          {
            title: '关联内容',
            dataIndex: 'contentCount',
            width: 110,
            render: (_, record) => <Tag>{record.contentCount ?? 0}</Tag>,
          },
          {
            title: '子分类',
            dataIndex: 'childCount',
            width: 100,
            render: (_, record) => <Tag>{record.childCount ?? 0}</Tag>,
          },
          {
            title: '操作',
            valueType: 'option',
            render: (_, record) => [
              <a key="child" onClick={() => setCreatingParent(record)}>
                新增子分类
              </a>,
              <a key="edit" onClick={() => setEditing(record)}>
                编辑
              </a>,
              <Popconfirm
                key="delete"
                title="确认删除？"
                description="存在子分类或关联内容时无法删除。"
                onConfirm={async () => {
                  setDeletingId(record.id);
                  try {
                    await deleteAdminCategory(record.id);
                    message.success('已删除');
                    setReloadKey((key) => key + 1);
                  } finally {
                    setDeletingId(undefined);
                  }
                }}
              >
                <a style={{ color: '#ff4d4f' }}>
                  {deletingId === record.id ? '处理中' : '删除'}
                </a>
              </Popconfirm>,
            ],
          },
        ]}
      />
      <ModalForm<CategoryMutationInput>
        title={
          editing
            ? `编辑分类：${editing.name}`
            : creatingParent?.id
              ? `新增子分类：${creatingParent.name}`
              : '新建一级分类'
        }
        open={!!editing || !!creatingParent}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => {
            setEditing(null);
            setCreatingParent(null);
          },
        }}
        initialValues={{
          name: editing?.name,
          slug: editing?.slug,
          parentId: editing?.parentId ?? creatingParent?.id,
          sort: editing?.sort ?? 0,
        }}
        onFinish={submit}
      >
        <ProFormText name="name" label="名称" rules={[{ required: true }]} />
        <ProFormText name="slug" label="Slug" rules={[{ required: true }]} />
        <ProFormSelect
          name="parentId"
          label="父级分类"
          options={parentOptions}
          allowClear
        />
        <ProFormDigit name="sort" label="排序" initialValue={0} />
      </ModalForm>
    </PageContainer>
  );
};

export default Categories;
