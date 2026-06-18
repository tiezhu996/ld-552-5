import { FunnelPlotOutlined } from '@ant-design/icons';
import { Card, Select, Space, Spin, Tooltip, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../utils/api';

const STAGE_COLORS = ['#1f7a5c', '#2a9d7e', '#52c4a0', '#85d8bf', '#b8ebd8'];
const RATE_LABELS: Record<string, string> = {
  submittedToScreened: '投递→初筛',
  screenedToInterviewed: '初筛→面试',
  interviewedToOffered: '面试→录用',
  offeredToHired: '录用→入职',
};

interface FunnelJob {
  jobId: number;
  title: string;
  stages: { name: string; count: number }[];
  rates: Record<string, number>;
}

export default function FunnelPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>();
  const [funnel, setFunnel] = useState<FunnelJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/jobs').then(({ data }) => setJobs(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get('/jobs/funnel', { params: { jobId: selectedJobId } })
      .then(({ data }) => setFunnel(data))
      .finally(() => setLoading(false));
  }, [selectedJobId]);

  const renderFunnel = (item: FunnelJob) => {
    const maxCount = Math.max(...item.stages.map((s) => s.count), 1);
    return (
      <Card className="tf-card" key={item.jobId} style={{ marginBottom: 24 }}>
        <Typography.Title level={4} style={{ marginTop: 0, color: '#17362c' }}>
          {item.title}
        </Typography.Title>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center', padding: '8px 0' }}>
          {item.stages.map((stage, i) => {
            const widthPct = Math.max((stage.count / maxCount) * 100, 8);
            const prevCount = i > 0 ? item.stages[i - 1].count : stage.count;
            const stageRate = i > 0 && prevCount > 0 ? ((stage.count / prevCount) * 100).toFixed(1) : null;
            return (
              <div key={stage.name} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < item.stages.length - 1 ? 0 : 0 }}>
                <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
                  <Typography.Text strong style={{ fontSize: 14 }}>{stage.name}</Typography.Text>
                </div>
                <Tooltip title={`${stage.count} 人${stageRate ? `，转化率 ${stageRate}%` : ''}`}>
                  <div
                    style={{
                      width: `${widthPct}%`,
                      minWidth: 32,
                      height: 48,
                      background: STAGE_COLORS[i],
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: i < 3 ? '#f7f2e8' : '#17362c',
                      fontWeight: 700,
                      fontSize: 18,
                      transition: 'width 0.4s ease',
                    }}
                  >
                    {stage.count}
                  </div>
                </Tooltip>
                <div style={{ minWidth: 72 }}>
                  {stageRate !== null && (
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      ↓ {stageRate}%
                    </Typography.Text>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {Object.entries(item.rates).map(([key, val]) => (
            <div key={key} style={{ background: '#ebe6d8', borderRadius: 6, padding: '8px 14px', flex: '1 1 120px', minWidth: 120 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{RATE_LABELS[key]}</Typography.Text>
              <div style={{ fontWeight: 700, fontSize: 20, color: '#1f7a5c' }}>{val}%</div>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <>
      <div>
        <h1 className="page-title">招聘漏斗</h1>
        <p className="subtle">按职位查看投递→初筛→面试→录用→入职各阶段人数与转化率。</p>
      </div>
      <div className="toolbar">
        <Space>
          <Select
            allowClear
            placeholder="全部职位"
            style={{ width: 240 }}
            value={selectedJobId}
            onChange={(v) => setSelectedJobId(v)}
            options={jobs.map((j) => ({ value: j.id, label: j.title }))}
          />
        </Space>
      </div>
      <Spin spinning={loading}>
        {funnel.length === 0 && !loading ? (
          <Card className="tf-card" style={{ textAlign: 'center', padding: 48 }}>
            <FunnelPlotOutlined style={{ fontSize: 48, color: '#b8ebd8' }} />
            <p className="subtle" style={{ marginTop: 16 }}>暂无漏斗数据</p>
          </Card>
        ) : (
          funnel.map(renderFunnel)
        )}
      </Spin>
    </>
  );
}
