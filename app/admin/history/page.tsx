import { HistoryClient } from "@/components/history/HistoryClient";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminHistoryPage() {
  return (
    <AdminShell
      active="history"
      title="历史与素材"
      description="管理员视角查看生成图片、来源用户、批量删除和素材使用情况。"
    >
      <HistoryClient embedded />
    </AdminShell>
  );
}
