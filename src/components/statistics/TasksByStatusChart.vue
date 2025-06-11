<template>
  <div class="chart-container">
    <div v-if="tasks.length > 0">
      <div style="height: 270px; width: 100%">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart :data="chartData">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="count" name="Task Count" fill="#8884d8" />
            <Bar yAxisId="right" dataKey="avgCompletion" name="Average Progress (%)" fill="#82ca9d" />
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
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// Definicja typów
interface Task {
  id: string;
  status: string;
  completion?: number;
  [key: string]: any;
}

interface ChartDataPoint {
  status: string;
  count: number;
  avgCompletion: number;
}

const props = defineProps<{
  tasks: Task[];
  statuses: string[];
}>();

const chartData = computed((): ChartDataPoint[] => {
  return props.statuses.map((status) => {
    const tasksWithStatus = props.tasks.filter((task) => task.status === status);
    const count = tasksWithStatus.length;

    let avgCompletion = 0;
    if (count > 0) {
      const totalCompletion = tasksWithStatus.reduce((sum, task) => sum + (task.completion || 0), 0);
      avgCompletion = Math.round(totalCompletion / count);
    }

    return {
      status,
      count,
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