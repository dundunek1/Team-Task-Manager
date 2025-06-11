<template>
  <div class="chart-container">
    <div v-if="tasks.length > 0 && assignees.length > 0">
      <div style="height: 270px; width: 100%">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart :data="chartData">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="taskCount" name="Task Count" fill="#8884d8" />
            <Bar dataKey="avgCompletion" name="Average Progress (%)" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div v-else class="no-data">
      <p>No data available</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getAuth } from "firebase/auth";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const auth = getAuth();

// Definiowanie typów
interface Task {
  id: string;
  assignedTo?: string | null;
  completion?: number;
  [key: string]: any;
}

interface Member {
  uid: string;
  firstName?: string;
  lastName?: string;
}

interface Group {
  members: Member[];
  [key: string]: any;
}

const props = defineProps<{
  tasks: Task[];
  group: Group;
}>();

const assignees = computed(() => {
  const uniqueAssignees = new Set<string | null>();
  props.tasks.forEach((task) => {
    if (task.assignedTo) {
      uniqueAssignees.add(task.assignedTo);
    }
  });

  // Also add unassigned tasks
  uniqueAssignees.add(null);

  return Array.from(uniqueAssignees);
});

const getAssigneeName = (assigneeId: string | null): string => {
  if (!assigneeId) return "Unassigned";

  if (assigneeId === auth.currentUser?.uid) {
    return "You";
  }

  const memberDetails = props.group.members.find((m) => m.uid === assigneeId);

  if (memberDetails) {
    return `${memberDetails.firstName || ""} ${memberDetails.lastName || ""}`.trim() || assigneeId.substring(0, 8);
  }

  return assigneeId.substring(0, 8) + "...";
};

const chartData = computed(() => {
  return assignees.value.map((assigneeId) => {
    const assigneeTasks = props.tasks.filter((task) => task.assignedTo === assigneeId);
    const taskCount = assigneeTasks.length;

    let avgCompletion = 0;
    if (taskCount > 0) {
      const totalCompletion = assigneeTasks.reduce((sum, task) => sum + (task.completion || 0), 0);
      avgCompletion = Math.round(totalCompletion / taskCount);
    }

    return {
      id: assigneeId,
      name: getAssigneeName(assigneeId),
      taskCount,
      avgCompletion,
    };
  });
});
</script>

<style scoped>
.chart-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6c757d;
  font-style: italic;
}
</style>
