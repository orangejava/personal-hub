import { DownloadOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { AiAsset, AiGenerationTask } from '@personal-hub/shared-types';
import { Button, Image, Modal } from 'antd';
import React, { useEffect, useState } from 'react';
import AiAuthenticatedMedia from '@/components/ai/AiAuthenticatedMedia';
import {
  AI_MEDIA_QUALITY_LABELS,
  AI_MEDIA_RESOLUTION_LABELS,
  formatAiMediaParamLabel,
} from '@/components/ai/mediaLabels';
import { downloadAiAsset, releaseAiAssetObjectUrl, resolveAiAssetObjectUrl } from '@/services/ai';

export interface AiMediaDetailModalProps {
  open: boolean;
  asset?: AiAsset | null;
  assets?: AiAsset[];
  task?: AiGenerationTask | null;
  modelLabel?: string;
  onClose: () => void;
}

function resolveCurrentIndex(asset: AiAsset | null | undefined, assets: AiAsset[]) {
  if (!asset) return 0;
  const index = assets.findIndex((item) => item.id === asset.id);
  return index >= 0 ? index : 0;
}

function resolveMediaKind(
  asset?: AiAsset | null,
  task?: AiGenerationTask | null,
): 'image' | 'video' {
  if (asset?.type === 'video' || task?.toolType === 'video') return 'video';
  return 'image';
}

interface DetailField {
  key: string;
  label: string;
  value: string;
}

function resolveDetailFields(input: {
  kind: 'image' | 'video';
  modelLabel: string;
  sizeLabel: string;
  styleLabel: string;
  qualityLabel: string;
  resolutionLabel: string;
  durationLabel: string;
  createdAtLabel: string;
}): DetailField[] {
  const fields: DetailField[] = [
    { key: 'model', label: '模型', value: input.modelLabel },
    { key: 'size', label: input.kind === 'video' ? '比例' : '尺寸', value: input.sizeLabel },
    { key: 'style', label: '风格', value: input.styleLabel },
  ];
  if (input.kind === 'video') {
    fields.push({ key: 'duration', label: '时长', value: input.durationLabel });
  } else {
    fields.push(
      { key: 'quality', label: '画质', value: input.qualityLabel },
      { key: 'resolution', label: '清晰度', value: input.resolutionLabel },
    );
  }
  fields.push({ key: 'createdAt', label: '创建时间', value: input.createdAtLabel });
  return fields;
}

/**
 * 图片/视频共用详情弹窗。
 * 左侧看媒体，右侧上中下：下载+缩略图、提示词再配置字段、底部预留。
 */
const AiMediaDetailModal: React.FC<AiMediaDetailModalProps> = ({
  open,
  asset,
  assets = [],
  task,
  modelLabel,
  onClose,
}) => {
  const gallery = assets.length > 0 ? assets : asset ? [asset] : [];
  const galleryKey = gallery.map((item) => item.id).join('|');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>();
  const current = gallery[currentIndex];
  const kind = resolveMediaKind(current, task);

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(resolveCurrentIndex(asset, gallery));
    setPreviewOpen(false);
  }, [asset?.id, galleryKey, open]);

  useEffect(() => {
    if (!current) {
      setPreviewSrc(undefined);
      return;
    }
    let cancelled = false;
    void resolveAiAssetObjectUrl(current).then((url) => {
      if (!cancelled) {
        setPreviewSrc(url);
      }
    });
    return () => {
      cancelled = true;
      releaseAiAssetObjectUrl(current.id);
    };
  }, [current?.id, current?.fileUrl, current?.thumbnailUrl]);

  const canSwitch = gallery.length > 1;
  const fields = resolveDetailFields({
    kind,
    modelLabel: modelLabel ?? task?.modelName ?? current?.modelId ?? '未记录',
    sizeLabel: task?.params?.size ?? '未记录',
    styleLabel: task?.params?.style ?? '未设置',
    qualityLabel: formatAiMediaParamLabel(task?.params?.quality, AI_MEDIA_QUALITY_LABELS),
    resolutionLabel: formatAiMediaParamLabel(task?.params?.resolution, AI_MEDIA_RESOLUTION_LABELS),
    durationLabel: task?.params?.durationSeconds
      ? `${task.params.durationSeconds} 秒`
      : '未设置',
    createdAtLabel: current
      ? new Date(current.createdAt).toLocaleString()
      : '—',
  });
  const promptText = current?.prompt || task?.prompt || '暂无 Prompt';

  const handlePrev = () => {
    if (!canSwitch) return;
    setPreviewOpen(false);
    setCurrentIndex((index) => (index - 1 + gallery.length) % gallery.length);
  };

  const handleNext = () => {
    if (!canSwitch) return;
    setPreviewOpen(false);
    setCurrentIndex((index) => (index + 1) % gallery.length);
  };

  const handleDownload = () => {
    if (!current) return;
    void downloadAiAsset(current);
  };

  return (
    <Modal
      centered
      destroyOnHidden
      classNames={{ root: 'ph-ai-media-detail-modal' }}
      footer={null}
      open={open}
      title={kind === 'video' ? '视频详情' : '图片详情'}
      width="min(1080px, 92vw)"
      onCancel={onClose}
    >
      {current ? (
        <div className="ph-ai-media-detail">
          <section className="ph-ai-media-detail-stage">
            {kind === 'image' ? (
              <button
                className="ph-ai-media-detail-main"
                type="button"
                onClick={() => setPreviewOpen(true)}
              >
                <AiAuthenticatedMedia
                  alt={current.title}
                  asset={current}
                  className="ph-ai-media-detail-viewer"
                />
              </button>
            ) : (
              <div className="ph-ai-media-detail-main">
                <AiAuthenticatedMedia
                  alt={current.title}
                  asset={current}
                  className="ph-ai-media-detail-viewer"
                  controls
                />
              </div>
            )}
            {canSwitch && (
              <>
                <Button
                  aria-label="上一项"
                  className="ph-ai-media-detail-switch ph-ai-media-detail-switch-prev"
                  icon={<LeftOutlined />}
                  shape="circle"
                  onClick={handlePrev}
                />
                <Button
                  aria-label="下一项"
                  className="ph-ai-media-detail-switch ph-ai-media-detail-switch-next"
                  icon={<RightOutlined />}
                  shape="circle"
                  onClick={handleNext}
                />
              </>
            )}
          </section>
          <aside className="ph-ai-media-detail-side">
            <div className="ph-ai-media-detail-side-top">
              <Button
                className="ph-ai-media-detail-download"
                icon={<DownloadOutlined />}
                type="primary"
                onClick={handleDownload}
              >
                下载
              </Button>
              <div className="ph-ai-media-detail-thumbs">
                {gallery.map((item, index) => (
                  <button
                    className={[
                      'ph-ai-media-detail-thumb',
                      index === currentIndex ? 'ph-ai-media-detail-thumb-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPreviewOpen(false);
                      setCurrentIndex(index);
                    }}
                  >
                    <AiAuthenticatedMedia
                      asset={item}
                      className="ph-ai-media-detail-thumb-media"
                      controls={false}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="ph-ai-media-detail-side-mid">
              <h3 className="ph-ai-media-detail-title">{current.title || '未命名'}</h3>
              <div className="ph-ai-media-detail-prompt">
                <span>Prompt</span>
                <p>{promptText}</p>
              </div>
              <dl className="ph-ai-media-detail-fields">
                {fields.map((field) => (
                  <div className="ph-ai-media-detail-field" key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="ph-ai-media-detail-side-bottom" />
          </aside>
          {kind === 'image' && previewSrc && (
            <Image
              preview={{
                open: previewOpen,
                src: previewSrc,
                onOpenChange: setPreviewOpen,
              }}
              src={previewSrc}
              style={{ display: 'none' }}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default AiMediaDetailModal;
