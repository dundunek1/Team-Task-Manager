<template>
  <div class="statistics-container">
    <div v-if="selectedGroup">
      <h3>Statistics for group: {{ selectedGroup.name }}</h3>

      <!-- Tabs -->
      <ul class="nav nav-tabs mb-4">
        <li class="nav-item">
          <a class="nav-link" :class="{ active: activeTab === 'summary' }" @click.prevent="activeTab = 'summary'" href="#"> <i class="fa-solid fa-chart-pie me-2"></i>Summary </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" :class="{ active: activeTab === 'activity' }" @click.prevent="activeTab = 'activity'" href="#">
            <i class="fa-solid fa-history me-2"></i>Activity Feed
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" :class="{ active: activeTab === 'aging' }" @click.prevent="activeTab = 'aging'" href="#">
            <i class="fa-solid fa-hourglass-half me-2"></i>Task Aging
          </a>
        </li>
      </ul>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Summary Tab -->
        <div v-if="activeTab === 'summary'" class="tab-pane active">
          <div class="progress-summary card p-3 mb-4">
            <h5>Overall Task Progress</h5>
            <div class="progress-container">
              <div class="progress-info d-flex justify-content-between mb-2">
                <span>Overall progress: {{ overallCompletion }}%</span>
                <span>{{ completedTasks }} / {{ taskStore.tasks.length }} tasks completed</span>
              </div>
              <div class="progress" style="height: 20px">
                <div
                  class="progress-bar bg-success"
                  role="progressbar"
                  :style="`width: ${overallCompletion}%`"
                  :aria-valuenow="overallCompletion"
                  aria-valuemin="0"
                  aria-valuemax="100">
                  {{ overallCompletion }}%
                </div>
              </div>
            </div>
          </div>

          <div class="charts-container">
            <!-- Task Completion Overview -->
            <div class="chart-card">
              <h4>Task Completion Overview</h4>
              <div class="chart-wrapper">
                <div class="overall-stats">
                  <div class="stat-card">
                    <h5>Average Progress</h5>
                    <p class="stat-value">{{ averageCompletion }}%</p>
                  </div>
                  <div class="stat-card">
                    <h5>Completed Tasks</h5>
                    <p class="stat-value">{{ completedTasksCount }} / {{ taskStore.tasks.length }}</p>
                  </div>
                </div>

                <!-- Simple visualization -->
                <div class="simple-pie-chart">
                  <div
                    class="pie-segment"
                    :style="{
                      '--segment-percent': `${averageCompletion}%`,
                      '--segment-color1': '#28a745',
                      '--segment-color2': '#dc3545',
                    }"></div>
                  <div class="pie-label">{{ averageCompletion }}%</div>
                </div>

                <div class="legend">
                  <div class="legend-item">
                    <span class="legend-color" style="background-color: #28a745"></span>
                    <span>Completed</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-color" style="background-color: #dc3545"></span>
                    <span>Remaining</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Progress by Status -->
            <div class="chart-card">
              <h4>Progress by Status</h4>
              <div class="chart-wrapper">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Tasks</th>
                      <th>Avg. Progress</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in statusesData" :key="item.status">
                      <td>{{ item.status }}</td>
                      <td>{{ item.count }}</td>
                      <td>{{ item.avgCompletion }}%</td>
                      <td>
                        <div class="progress" style="height: 10px">
                          <div class="progress-bar" :class="getProgressClass(item.avgCompletion)" role="progressbar" :style="`width: ${item.avgCompletion}%`"></div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Progress by Assignee -->
            <div class="chart-card">
              <h4>Progress by Assignee</h4>
              <div class="chart-wrapper">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Assignee</th>
                      <th>Tasks</th>
                      <th>Avg. Progress</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in assigneesData" :key="item.id || 'unassigned'">
                      <td>{{ item.name }}</td>
                      <td>{{ item.taskCount }}</td>
                      <td>{{ item.avgCompletion }}%</td>
                      <td>
                        <div class="progress" style="height: 10px">
                          <div class="progress-bar" :class="getProgressClass(item.avgCompletion)" role="progressbar" :style="`width: ${item.avgCompletion}%`"></div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Activity Feed Tab -->
        <div v-if="activeTab === 'activity'" class="tab-pane active">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Activity Feed</h5>
            </div>
            <div class="card-body p-0">
              <ActivityFeed />
            </div>
          </div>
        </div>

        <!-- Task Aging Tab -->
        <div v-if="activeTab === 'aging'" class="tab-pane active">
          <TaskAging />
        </div>
      </div>
    </div>

    <div v-else class="no-group-selected">
      <div class="card text-center p-4">
        <i class="fa-solid fa-chart-line fa-3x text-primary mb-3"></i>
        <h4>No Group Selected</h4>
        <p class="text-muted">Pick a group to view task statistics.</p>
      </div>
    </div>

    <!-- Task Details Modal -->
    <div v-if="selectedTaskForDetails" class="modal fade" id="taskDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-body p-0">
            <TaskTimeline :task="selectedTaskForDetails" @close="closeTaskDetails" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref, nextTick } from "vue";
import { useGroupStore } from "@/stores/groupStore";
import { useTaskStore } from "@/stores/taskStore";
import { getAuth } from "firebase/auth";
import ActivityFeed from "../statistics/TaskActivityFeed.vue";
import TaskAging from "../statistics/TaskAging.vue";
import TaskTimeline from "../statistics/TaskTImeline.vue";

// Deklaracja modułu Bootstrap dla TypeScript
declare global {
  interface Window {
    bootstrap: any;
  }
}

const groupStore = useGroupStore();
const taskStore = useTaskStore();
const auth = getAuth();
const selectedGroup = computed(() => groupStore.selectedGroup);

const activeTab = ref("summary");
const selectedTaskForDetails = ref(null);

const overallCompletion = computed(() => {
  if (taskStore.tasks.length === 0) return 0;

  const totalCompletion = taskStore.tasks.reduce((sum, task) => sum + (task.completion || 0), 0);
  const maxPossibleCompletion = taskStore.tasks.length * 100;

  return Math.round((totalCompletion / maxPossibleCompletion) * 100);
});

const completedTasks = computed(() => {
  return taskStore.tasks.filter((task) => (task.completion || 0) === 100).length;
});

const averageCompletion = computed(() => {
  if (taskStore.tasks.length === 0) return 0;

  const totalCompletion = taskStore.tasks.reduce((sum, task) => sum + (task.completion || 0), 0);
  return Math.round(totalCompletion / taskStore.tasks.length);
});

const completedTasksCount = computed(() => {
  return taskStore.tasks.filter((task) => (task.completion || 0) === 100).length;
});

const statusesData = computed(() => {
  return groupStore.statuses.map((status) => {
    const tasksWithStatus = taskStore.tasks.filter((task) => task.status === status);
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

const assigneesData = computed(() => {
  const uniqueAssignees = new Set<string | null>();
  taskStore.tasks.forEach((task) => {
    uniqueAssignees.add(task.assignedTo || null);
  });

  return Array.from(uniqueAssignees).map((assigneeId) => {
    const assigneeTasks = taskStore.tasks.filter((task) => task.assignedTo === assigneeId);
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

function getAssigneeName(assigneeId: string | null): string {
  if (!assigneeId) return "Unassigned";

  if (assigneeId === auth.currentUser?.uid) {
    return "You";
  }

  if (!selectedGroup.value) return assigneeId.substring(0, 8) + "...";

  const memberDetails = selectedGroup.value.members.find((m: any) => {
    if (typeof m === "string") return m === assigneeId;
    return m.uid === assigneeId;
  });

  if (memberDetails) {
    if (typeof memberDetails === "string") {
      return memberDetails.substring(0, 8) + "...";
    }
    return `${memberDetails.firstName || ""} ${memberDetails.lastName || ""}`.trim() || assigneeId.substring(0, 8);
  }

  return assigneeId.substring(0, 8) + "...";
}

function getProgressClass(percentage: number): string {
  if (percentage >= 75) return "bg-success";
  if (percentage >= 25) return "bg-warning";
  return "bg-danger";
}

const openTaskDetails = (task: any) => {
  selectedTaskForDetails.value = task;

  nextTick(() => {
    // Używamy Bootstrap API bezpośrednio bez importu
    const modalElement = document.getElementById("taskDetailsModal");
    if (modalElement && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalElement);
      modal.show();
    }
  });
};

const closeTaskDetails = () => {
  const modalElement = document.getElementById("taskDetailsModal");
  if (modalElement && window.bootstrap) {
    const modal = window.bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
  }

  selectedTaskForDetails.value = null;
};

const fetchTasks = async () => {
  if (selectedGroup.value) {
    await taskStore.fetchTasksForGroup(selectedGroup.value.code);
  }
};

watch(
  () => selectedGroup.value,
  (newValue) => {
    if (newValue) {
      fetchTasks();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (selectedGroup.value) {
    fetchTasks();
  }
});
</script>

<style scoped>
.statistics-container {
  padding: 20px;
  background: #1e5c88;
  min-height: 100vh;
}

.nav-tabs {
  background-color: white;
  border-radius: 8px 8px 0 0;
  padding-top: 10px;
}

.nav-tabs .nav-link {
  color: #495057;
  cursor: pointer;
}

.nav-tabs .nav-link.active {
  font-weight: bold;
}

.tab-content {
  background-color: #f8f9fa;
  border-radius: 0 0 8px 8px;
  padding: 20px;
}

.progress-summary {
  background: white;
  border-radius: 8px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.charts-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.chart-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
}

.chart-wrapper {
  min-height: 200px;
  margin-top: 10px;
  position: relative;
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

.simple-pie-chart {
  width: 150px;
  height: 150px;
  margin: 0 auto;
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  background-color: #dc3545; /* Remaining color */
}

.pie-segment {
  position: absolute;
  width: 100%;
  height: 100%;
  background: conic-gradient(var(--segment-color1) 0% var(--segment-percent), var(--segment-color2) var(--segment-percent) 100%);
}

.pie-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  font-weight: bold;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.legend {
  display: flex;
  justify-content: center;
  margin-top: 15px;
  gap: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-color {
  display: inline-block;
  width: 15px;
  height: 15px;
  border-radius: 3px;
}

.no-group-selected {
  max-width: 500px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .charts-container {
    grid-template-columns: 1fr;
  }

  .tab-content {
    padding: 10px;
  }
}
</style>
