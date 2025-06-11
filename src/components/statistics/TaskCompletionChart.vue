<template>
  <div class="chart-container">
    <div v-if="tasks.length > 0">
      <div class="overall-stats">
        <div class="stat-card">
          <h5>Average Progress</h5>
          <p class="stat-value">{{ averageCompletion }}%</p>
        </div>
        <div class="stat-card">
          <h5>Completed Tasks</h5>
          <p class="stat-value">{{ completedTasksCount }} / {{ tasks.length }}</p>
        </div>
      </div>

      <div style="height: 250px; width: 100%">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie dataKey="value" nameKey="name" :data="pieData" cx="50%" cy="50%" :outerRadius="80" fill="#8884d8" label>
              <Cell key="completed" fill="#28a745" />
              <Cell key="remaining" fill="#dc3545" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
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
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

// Definicja typów
interface Task {
  id: string;
  completion?: number;
  [key: string]: any;
}

interface PieDataPoint {
  name: string;
  value: number;
}

const props = defineProps<{
  tasks: Task[];
}>();

const averageCompletion = computed((): number => {
  if (props.tasks.length === 0) return 0;

  const totalCompletion = props.tasks.reduce((sum, task) => sum + (task.completion || 0), 0);
  return Math.round(totalCompletion / props.tasks.length);
});

const completedTasksCount = computed((): number => {
  return props.tasks.filter((task) => (task.completion || 0) === 100).length;
});

const pieData = computed((): PieDataPoint[] => {
  const completed = props.tasks.reduce((sum, task) => sum + (task.completion || 0), 0);
  const total = props.tasks.length * 100;
  const remaining = total - completed;

  return [
    { name: "Completed", value: completed },
    { name: "Remaining", value: remaining },
  ];
});
</script>

<style scoped>
.chart-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.overall-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 15px;
}

.stat-card {
  text-align: center;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 5px;
  min-width: 120px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
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
