<!-- src/components/tasks/TaskAging.vue -->
<template>
  <div class="task-aging">
    <div class="card">
      <div class="card-header">
        <h5 class="mb-0">Task Aging Monitor</h5>
      </div>

      <div class="card-body">
        <div class="filters mb-3">
          <div class="row">
            <div class="col-md-4">
              <select v-model="agingCriteria" class="form-select">
                <option value="updatedAt">Time Since Last Update</option>
                <option value="statusAge">Time in Current Status</option>
                <option value="lowCompletion">Low Completion Progress</option>
              </select>
            </div>

            <div class="col-md-4">
              <select v-model="selectedStatus" class="form-select">
                <option value="">All Statuses</option>
                <option v-for="status in statuses" :key="status" :value="status">
                  {{ status }}
                </option>
              </select>
            </div>

            <div class="col-md-4">
              <select v-model="ageThreshold" class="form-select">
                <option :value="1">Older than 1 day</option>
                <option :value="3">Older than 3 days</option>
                <option :value="7">Older than 1 week</option>
                <option :value="14">Older than 2 weeks</option>
                <option :value="30">Older than 1 month</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="loading" class="text-center py-3">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>

        <div v-else-if="filteredTasks.length === 0" class="alert alert-success">
          <i class="fa-solid fa-check-circle me-2"></i>
          No aging tasks found with the current criteria.
        </div>

        <div v-else>
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Completion</th>
                  <th>{{ agingColumnLabel }}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in filteredTasks" :key="task.id" :class="getRowClass(task)">
                  <td>{{ task.name }}</td>
                  <td>
                    <span class="badge" :class="getStatusClass(task.status)">
                      {{ task.status }}
                    </span>
                  </td>
                  <td>{{ getAssigneeName(task.assignedTo) }}</td>
                  <td>
                    <div class="progress" style="height: 10px">
                      <div class="progress-bar" :class="getProgressClass(task.completion || 0)" role="progressbar" :style="`width: ${task.completion || 0}%`"></div>
                    </div>
                    <small>{{ task.completion || 0 }}%</small>
                  </td>
                  <td>{{ getAgingMetric(task) }}</td>
                  <td>
                    <button class="btn btn-sm btn-outline-primary me-1" @click="openTaskDetails(task)">
                      <i class="fa-solid fa-eye"></i>
                    </button>
                    <button v-if="canUpdateTask(task)" class="btn btn-sm btn-outline-success" @click="promptStatusUpdate(task)">
                      <i class="fa-solid fa-arrow-right"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="summary alert alert-warning mt-3">
            <i class="fa-solid fa-exclamation-triangle me-2"></i>
            Found <strong>{{ filteredTasks.length }}</strong> tasks that may need attention.
          </div>
        </div>
      </div>
    </div>

    <!-- Status Update Modal -->
    <div v-if="selectedTaskForUpdate" class="modal fade" id="updateStatusModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Update Task Status</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>
              Update status for: <strong>{{ selectedTaskForUpdate.name }}</strong>
            </p>
            <p>
              Current status: <strong>{{ selectedTaskForUpdate.status }}</strong>
            </p>

            <div class="mb-3">
              <label class="form-label">New Status:</label>
              <select v-model="newStatus" class="form-select">
                <option v-for="status in availableStatuses" :key="status" :value="status">
                  {{ status }}
                </option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" @click="updateTaskStatus">Update Status</button>
          </div>
        </div>
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
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useGroupStore } from "@/stores/groupStore";
import { useTaskStore } from "@/stores/taskStore";
import { getAuth } from "firebase/auth";
import { differenceInDays, parseISO, formatDistance } from "date-fns";
import { toast } from "vue-sonner";
import TaskTimeline from "../statistics/TaskTImeline.vue";

// Deklaracja Bootstrap dla TypeScript
declare global {
  interface Window {
    bootstrap: any;
  }
}

// Typ zadania z taskStore
type Task = (typeof taskStore.tasks)[0];

const groupStore = useGroupStore();
const taskStore = useTaskStore();
const auth = getAuth();

const selectedGroup = computed(() => groupStore.selectedGroup);
const statuses = computed(() => groupStore.statuses);

const loading = ref(false);
const agingCriteria = ref("updatedAt");
const selectedStatus = ref("");
const ageThreshold = ref(7); // Default: 1 week
const selectedTaskForUpdate = ref<Task | null>(null);
const selectedTaskForDetails = ref<Task | null>(null);
const newStatus = ref("");

const agingColumnLabel = computed(() => {
  switch (agingCriteria.value) {
    case "updatedAt":
      return "Time Since Update";
    case "statusAge":
      return "Time in Status";
    case "lowCompletion":
      return "Expected Completion";
    default:
      return "Aging Metric";
  }
});

const fetchTaskTimelines = async () => {
  if (!selectedGroup.value) return;

  try {
    loading.value = true;

    // In a real app, you would fetch status change events for all tasks
    // This is a simplified implementation
    await taskStore.fetchTasksForGroup(selectedGroup.value.code);

    // Add simulated status age data
    taskStore.tasks.forEach((task) => {
      if (!task.updatedAt) {
        task.updatedAt = new Date().toISOString();
      }

      // This would ideally come from activity logs
      if (!task.statusUpdatedAt) {
        task.statusUpdatedAt = task.updatedAt;
      }
    });
  } catch (error) {
    console.error("Error fetching task data:", error);
  } finally {
    loading.value = false;
  }
};

const filteredTasks = computed(() => {
  if (!taskStore.tasks) return [];

  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - ageThreshold.value);

  return taskStore.tasks
    .filter((task) => {
      // Status filter
      if (selectedStatus.value && task.status !== selectedStatus.value) {
        return false;
      }

      // Aging criteria filter
      switch (agingCriteria.value) {
        case "updatedAt":
          if (!task.updatedAt) return false;
          return new Date(task.updatedAt) < threshold;

        case "statusAge":
          if (!task.statusUpdatedAt) return false;
          return new Date(task.statusUpdatedAt) < threshold;

        case "lowCompletion":
          // Tasks with low completion that aren't recently updated
          if (task.status === "Completed") return false;
          if ((task.completion || 0) > 50) return false;
          if (task.updatedAt && new Date(task.updatedAt) > threshold) return false;
          return true;

        default:
          return false;
      }
    })
    .sort((a, b) => {
      // Sort by age (oldest first)
      const dateA = new Date(a.updatedAt || a.date);
      const dateB = new Date(b.updatedAt || b.date);
      return dateA.getTime() - dateB.getTime();
    });
});

const getRowClass = (task: Task) => {
  const daysSinceUpdate = task.updatedAt ? differenceInDays(new Date(), parseISO(task.updatedAt)) : 0;

  if (daysSinceUpdate > 30) return "table-danger";
  if (daysSinceUpdate > 14) return "table-warning";
  return "";
};

const getStatusClass = (status: string) => {
  switch (status) {
    case "To Do":
      return "bg-secondary";
    case "In Progress":
      return "bg-primary";
    case "Completed":
      return "bg-success";
    case "Blocked":
      return "bg-danger";
    case "On Hold":
      return "bg-warning";
    default:
      return "bg-info";
  }
};

const getProgressClass = (percentage: number) => {
  if (percentage >= 75) return "bg-success";
  if (percentage >= 25) return "bg-warning";
  return "bg-danger";
};

const getAgingMetric = (task: Task) => {
  switch (agingCriteria.value) {
    case "updatedAt":
      if (!task.updatedAt) return "Unknown";
      return formatDistance(parseISO(task.updatedAt), new Date(), { addSuffix: true });

    case "statusAge":
      if (!task.statusUpdatedAt) return "Unknown";
      return formatDistance(parseISO(task.statusUpdatedAt), new Date(), { addSuffix: true });

    case "lowCompletion":
      const expectedDays = 30 - (task.completion || 0) / 3.33; // Rough estimate
      return `Est. ${Math.round(expectedDays)} days needed`;

    default:
      return "N/A";
  }
};

const getAssigneeName = (assigneeId: string | null | undefined) => {
  if (!assigneeId) return "Unassigned";
  if (assigneeId === auth.currentUser?.uid) return "You";

  // Implement proper name resolution based on your data structure
  return assigneeId.substring(0, 8) + "...";
};

const canUpdateTask = (task: Task) => {
  return task.assignedTo === auth.currentUser?.uid || isGroupOwner.value;
};

const isGroupOwner = computed(() => {
  if (!selectedGroup.value || !auth.currentUser) return false;
  return selectedGroup.value.owner === auth.currentUser.uid;
});

const availableStatuses = computed(() => {
  if (!selectedTaskForUpdate.value) return [];

  // Exclude current status from available options
  return statuses.value.filter((status) => status !== selectedTaskForUpdate.value?.status);
});

const promptStatusUpdate = (task: Task) => {
  selectedTaskForUpdate.value = task;
  newStatus.value = task.status === "To Do" ? "In Progress" : "";

  // Show modal using Bootstrap
  nextTick(() => {
    const modalElement = document.getElementById("updateStatusModal");
    if (modalElement && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalElement);
      modal.show();
    }
  });
};

const updateTaskStatus = async () => {
  if (!selectedTaskForUpdate.value || !newStatus.value) return;

  try {
    await taskStore.updateTaskStatus(selectedTaskForUpdate.value.id, newStatus.value);

    // If moving to completed, set completion to 100%
    if (newStatus.value === "Completed") {
      await taskStore.updateTaskCompletion(selectedTaskForUpdate.value.id, 100);
    }

    // Close modal
    const modalElement = document.getElementById("updateStatusModal");
    if (modalElement && window.bootstrap) {
      const modal = window.bootstrap.Modal.getInstance(modalElement);
      if (modal) modal.hide();
    }

    // Reset selected task
    selectedTaskForUpdate.value = null;

    // Show success message
    toast.success("Task status updated successfully");
  } catch (error) {
    console.error("Error updating task status:", error);
    toast.error("Failed to update task status");
  }
};

const openTaskDetails = (task: Task) => {
  selectedTaskForDetails.value = task;

  // Show modal using Bootstrap
  nextTick(() => {
    const modalElement = document.getElementById("taskDetailsModal");
    if (modalElement && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalElement);
      modal.show();
    }
  });
};

const closeTaskDetails = () => {
  // Close modal
  const modalElement = document.getElementById("taskDetailsModal");
  if (modalElement && window.bootstrap) {
    const modal = window.bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
  }

  // Reset selected task
  selectedTaskForDetails.value = null;
};

onMounted(() => {
  if (selectedGroup.value) {
    fetchTaskTimelines();
  }
});

watch(
  () => selectedGroup.value,
  (newValue) => {
    if (newValue) {
      fetchTaskTimelines();
    }
  }
);

watch([() => agingCriteria.value, () => selectedStatus.value, () => ageThreshold.value], () => {
  // Any time the filtering criteria change, refresh task data
  fetchTaskTimelines();
});
</script>

<style scoped>
.task-aging {
  max-width: 100%;
  overflow-x: auto;
}

.filters {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
  margin-bottom: 20px;
}

.table th {
  position: sticky;
  top: 0;
  background-color: white;
  z-index: 1;
}

.progress {
  height: 8px;
  margin-bottom: 3px;
}
</style>
