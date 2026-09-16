import { describe, expect, it } from 'vitest';
import {
  buildMediaJobBody,
  readCreatedJobId,
  resolveAiAssetDownloadName,
} from './aiMediaJobBody';

describe('buildMediaJobBody', () => {
  it('视频请求带上时长，不带图片专用字段', () => {
    expect(
      buildMediaJobBody('video', {
        title: '短片',
        prompt: '一段产品镜头',
        modelId: 'not-a-uuid',
        params: {
          size: '9:16',
          style: '电影感',
          durationSeconds: 8,
          count: 4,
          quality: 'high',
        },
      }),
    ).toEqual({
      prompt: '一段产品镜头',
      size: '9:16',
      style: '电影感',
      durationSeconds: 8,
    });
  });

  it('图片请求带张数和画质，不带时长', () => {
    expect(
      buildMediaJobBody('image', {
        title: '海报',
        prompt: '科技感海报',
        modelId: '11111111-1111-4111-8111-111111111111',
        params: {
          size: '16:9',
          count: 2,
          quality: 'standard',
          resolution: '2k',
          durationSeconds: 6,
        },
      }),
    ).toEqual({
      prompt: '科技感海报',
      modelId: '11111111-1111-4111-8111-111111111111',
      size: '16:9',
      count: 2,
      quality: 'standard',
      resolution: '2k',
    });
  });
});

describe('readCreatedJobId', () => {
  it('兼容解包后的 id 和仍带着 data 的信封', () => {
    expect(readCreatedJobId({ id: 'job-1' })).toBe('job-1');
    expect(readCreatedJobId({ data: { id: 'job-2' } })).toBe('job-2');
    expect(readCreatedJobId({})).toBeUndefined();
  });
});

describe('resolveAiAssetDownloadName', () => {
  it('按资产类型补后缀', () => {
    expect(resolveAiAssetDownloadName({ title: '实验', type: 'image' })).toBe('实验.png');
    expect(resolveAiAssetDownloadName({ title: '', type: 'video' })).toBe('download.mp4');
  });
});
