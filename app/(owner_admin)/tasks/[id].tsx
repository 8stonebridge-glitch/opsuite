import { TaskDetailScreen } from '../../../src/components/tasks/TaskDetailScreen';

export default function OwnerTaskDetail() {
  return <TaskDetailScreen updatePath="/(owner_admin)/tasks/[id]/update" />;
}
