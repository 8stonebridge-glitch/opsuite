import { TaskDetailScreen } from '../../../src/components/tasks/TaskDetailScreen';

export default function SubAdminTaskDetail() {
  return <TaskDetailScreen updatePath="/(subadmin)/tasks/[id]/update" />;
}
