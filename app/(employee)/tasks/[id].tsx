import { TaskDetailScreen } from '../../../src/components/tasks/TaskDetailScreen';

export default function EmployeeTaskDetail() {
  return <TaskDetailScreen updatePath="/(employee)/tasks/[id]/update" />;
}
