"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  DollarSign,
  Gauge,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import clsx from "clsx";
import type { AdminStats } from "@/lib/types";
import { apiJson } from "@/components/client-api";
import { AdminShell } from "./AdminShell";

interface StatsResponse {
  stats: AdminStats;
}

const emptyStats: AdminStats = {
  today: { totalTasks: 0, succeededTasks: 0, failedTasks: 0, totalImages: 0, estimatedCost: 0 },
  week: { totalTasks: 0, succeededTasks: 0, failedTasks: 0, totalImages: 0, estimatedCost: 0 },
  popularTemplates: [],
  health: {
    provider: "sub2api",
    baseUrl: "未配置",
    imageModel: "未配置",
    imageConcurrency: 1,
    timeoutStreak: 0,
    autoDegradedAt: null,
    averageDurationSeconds: null,
    failureRate: 0,
    availabilityRate: 100,
    weekTimeoutTasks: 0,
  },
  topErrors: [],
  userSuccessRanking: [],
  groupUsage: [],
};

export function AdminOverviewClient() {
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStats(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const payload = await apiJson<StatsResponse>("/api/admin/stats");
      setStats(payload.stats);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "统计加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  return (
    <AdminShell
      active="overview"
      title="管理员后台"
      description="把系统健康、用户运营、模型稳定性和更新状态放在一个控制台里。"
      actions={
        <button className="button" type="button" onClick={loadStats} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "刷新中" : "刷新"}
        </button>
      }
    >
      {error ? <div className="toast-line error">{error}</div> : null}

      <section className="stats-grid">
        <StatCard label="今日生成次数" value={stats.today.totalTasks} icon={<BarChart3 size={18} />} />
        <StatCard label="本周生成次数" value={stats.week.totalTasks} icon={<TrendingUp size={18} />} />
        <StatCard label="成功 / 失败" value={`${stats.week.succeededTasks} / ${stats.week.failedTasks}`} icon={<BarChart3 size={18} />} />
        <StatCard label="本周预估成本" value={`$${stats.week.estimatedCost.toFixed(2)}`} icon={<DollarSign size={18} />} />
        <StatCard label="模型可用率" value={`${stats.health.availabilityRate}%`} icon={<Activity size={18} />} />
        <StatCard label="平均耗时" value={stats.health.averageDurationSeconds === null ? "暂无" : `${stats.health.averageDurationSeconds}s`} icon={<Clock size={18} />} />
        <StatCard label="本周超时任务" value={stats.health.weekTimeoutTasks} icon={<AlertTriangle size={18} />} />
        <StatCard label="当前并发" value={stats.health.imageConcurrency} icon={<Gauge size={18} />} />
      </section>

      <section className="admin-command-grid">
        <Link className="admin-command-card" href="/admin/users">
          <Users size={20} aria-hidden="true" />
          <strong>管理账号</strong>
          <span>分页、搜索、筛选、批量禁用和调整额度。</span>
        </Link>
        <Link className="admin-command-card" href="/admin/groups">
          <Gauge size={20} aria-hidden="true" />
          <strong>调整分组策略</strong>
          <span>按分组控制额度、查看成员数和本月消耗。</span>
        </Link>
        <Link className="admin-command-card" href="/admin/models">
          <Activity size={20} aria-hidden="true" />
          <strong>检查模型稳定性</strong>
          <span>查看渠道、并发、OAuth 账号和失败状态。</span>
        </Link>
      </section>

      <div className="admin-dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>模型健康</h2>
            </div>
            <span className={clsx("badge", stats.health.timeoutStreak > 0 ? "warning" : "success")}>
              连续超时 {stats.health.timeoutStreak}
            </span>
          </div>
          <div className="panel-body popular-list">
            <div className="popular-row">
              <strong>接口模式</strong>
              <span className="badge">{stats.health.provider === "openai_oauth" ? "内置 OAuth" : "API Key"}</span>
            </div>
            <div className="popular-row">
              <strong>Base URL</strong>
              <span>{stats.health.baseUrl}</span>
            </div>
            <div className="popular-row">
              <strong>模型</strong>
              <span>{stats.health.imageModel}</span>
            </div>
            <div className="popular-row">
              <strong>失败率</strong>
              <span className={clsx("badge", stats.health.failureRate > 20 ? "danger" : stats.health.failureRate > 0 ? "warning" : "success")}>
                {stats.health.failureRate}%
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>账号与分组消耗</h2>
            </div>
            <span className="badge">本周 / 本月</span>
          </div>
          <div className="panel-body popular-list">
            {stats.userSuccessRanking.length > 0 ? (
              stats.userSuccessRanking.map((user) => (
                <div className="popular-row" key={user.userId ?? "anonymous"}>
                  <strong>{user.name}</strong>
                  <span className="badge">{user.succeededTasks}/{user.totalTasks} · {user.successRate}%</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span>暂无账号生成数据</span>
              </div>
            )}
            {stats.groupUsage.map((group) => (
              <div className="popular-row" key={group.groupId ?? "ungrouped"}>
                <strong>{group.name}</strong>
                <span className="badge">{group.used}/{group.quota ?? "不限"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="stat-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
