<template>
  <div class="home-container">
    <div v-if="selectedGroup">
      <h3>Tasks for group: {{ selectedGroup.name }}</h3>

      <div class="sorting-controls">
        <button @click="toggleSorting" class="sort-button">
          <i class="fa-solid fa-sort"></i>
          Sort by priority {{ sortDirection === "asc" ? "(Low to High)" : sortDirection === "desc" ? "(High to Low)" : "" }}
        </button>
      </div>

      <draggable v-model="groupStore.statuses" group="columns" item-key="status" class="task-columns" :disabled="!isGroupOwner" @end="reorderColumns">
        <template #item="{ element: status }">
          <div class="task-column" :class="{ 'restricted-column': status === 'Completed' && !isGroupOwner }">
            <div class="column-header">
              <h4>{{ status }}</h4>
              <small v-if="!isGroupOwner && status === 'Completed'" class="text-muted"> <i class="fa-solid fa-lock me-1"></i>Product Manager only </small>
            </div>

            <draggable
              :list="getSortedTasksForStatus(status)"
              :group="{
                name: 'tasks',
                pull: status === 'Completed' && !isGroupOwner ? false : true,
                put: status === 'Completed' && !isGroupOwner ? false : true,
              }"
              item-key="id"
              class="task-list"
              @start="startTaskDrag"
              @end="endTaskDrag">
              <template #item="{ element: task }">
                <li
                  class="task-card"
                  :class="{
                    'favorite-task': task.isFavorite,
                    'priority-high': task.priority === 'high',
                    'priority-medium': task.priority === 'medium',
                    'priority-low': task.priority === 'low',
                  }">
                  <div class="task-header">
                    <div class="task-title-wrapper">
                      <div class="priority-indicator" v-if="task.priority">
                        <i class="fa-solid fa-flag" :class="`text-${getPriorityColor(task.priority)}`" :title="`Priority: ${task.priority}`"></i>
                      </div>
                      <div v-if="!editingTaskId || editingTaskId !== task.id">
                        <strong>{{ task.name }}</strong>
                      </div>
                      <div v-else>
                        <input v-model="editingTaskName" @keyup.enter="saveTaskName(task.id)" @blur="cancelEdit" ref="editInput" class="form-control" />
                      </div>
                    </div>
                    <div class="task-actions">
                      <i class="fa-solid fa-pen-to-square" @click="editTask(task)"></i>
                      <i :class="[task.isFavorite ? 'fa-solid' : 'fa-regular', 'fa-star']" @click="toggleFavorite(task)"></i>
                      <i v-if="isGroupOwner" class="fa-solid fa-trash text-danger" @click="deleteTask(task)"></i>
                    </div>
                  </div>

                  <div class="task-details">
                    <p class="task-date">{{ task.date }}</p>
                    <!-- Progress bar -->
                    <div class="task-progress mt-2 mb-2">
                      <div class="progress-label d-flex justify-content-between">
                        <small>Progress:</small>
                        <small>{{ task.completion || 0 }}%</small>
                      </div>
                      <div class="progress" style="height: 8px">
                        <div
                          class="progress-bar"
                          :class="{
                            'bg-success': (task.completion || 0) >= 75,
                            'bg-warning': (task.completion || 0) >= 25 && (task.completion || 0) < 75,
                            'bg-danger': (task.completion || 0) < 25,
                          }"
                          role="progressbar"
                          :style="`width: ${task.completion || 0}%`"
                          :aria-valuenow="task.completion || 0"
                          aria-valuemin="0"
                          aria-valuemax="100"></div>
                      </div>
                      <!-- Progress slider with updated permissions -->
                      <div v-if="(isGroupOwner || task.assignedTo === auth.currentUser?.uid || !task.assignedTo) && task.status !== 'Completed'" class="progress-controls mt-1">
                        <input type="range" class="form-range" min="0" max="100" step="5" :value="task.completion || 0" @change="updateCompletion(task, $event)" />
                      </div>
                    </div>
                    <div class="task-controls">
                      <div class="task-priority">
                        <div class="dropdown" v-if="isGroupOwner">
                          <button class="btn btn-sm dropdown-toggle priority-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="fa-solid fa-flag me-1" :class="`text-${getPriorityColor(task.priority)}`"></i>
                            {{ task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "Priority" }}
                          </button>
                          <ul class="dropdown-menu">
                            <li class="dropdown-item" @click="setTaskPriority(task, 'high')"><i class="fa-solid fa-flag text-danger me-2"></i> High</li>
                            <li class="dropdown-item" @click="setTaskPriority(task, 'medium')"><i class="fa-solid fa-flag text-warning me-2"></i> Medium</li>
                            <li class="dropdown-item" @click="setTaskPriority(task, 'low')"><i class="fa-solid fa-flag text-success me-2"></i> Low</li>
                            <li v-if="task.priority" class="dropdown-item" @click="setTaskPriority(task, null)">
                              <span class="text-secondary"><i class="fa-regular fa-flag me-2"></i> None</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div class="task-assignment">
                        <!-- Completion dropdown with updated permissions -->
                        <div class="task-completion ms-2" v-if="task.status !== 'Completed' && (isGroupOwner || task.assignedTo === auth.currentUser?.uid || !task.assignedTo)">
                          <div class="dropdown">
                            <button class="btn btn-sm dropdown-toggle completion-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                              <i class="fa-solid fa-percentage me-1"></i>
                              {{ task.completion || 0 }}%
                            </button>
                            <ul class="dropdown-menu">
                              <li class="dropdown-item" @click="setTaskCompletion(task, 0)">0%</li>
                              <li class="dropdown-item" @click="setTaskCompletion(task, 25)">25%</li>
                              <li class="dropdown-item" @click="setTaskCompletion(task, 50)">50%</li>
                              <li class="dropdown-item" @click="setTaskCompletion(task, 75)">75%</li>
                              <li class="dropdown-item" @click="setTaskCompletion(task, 100)">100%</li>
                              <li><hr class="dropdown-divider" /></li>
                              <li>
                                <div class="px-3">
                                  <label for="customCompletion" class="form-label small">Custom value:</label>
                                  <div class="input-group input-group-sm">
                                    <input type="number" class="form-control form-control-sm" id="customCompletion" min="0" max="100" v-model="customCompletionValue" @click.stop />
                                    <button class="btn btn-outline-secondary btn-sm" type="button" @click.stop="setTaskCompletion(task, parseInt(customCompletionValue))">
                                      Set
                                    </button>
                                  </div>
                                </div>
                              </li>
                            </ul>
                          </div>
                        </div>
                        <div v-if="isGroupOwner" class="dropdown">
                          <button class="btn btn-sm dropdown-toggle assign-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="fa-solid fa-user-tag me-1"></i>
                            {{ task.assignedTo ? getMemberName(selectedGroup, task.assignedTo) : "Assign" }}
                          </button>
                          <ul class="dropdown-menu">
                            <li v-for="member in selectedGroup.members" :key="member.uid" class="dropdown-item" @click="assignTaskToUser(task, member)">
                              {{ getMemberName(selectedGroup, member.uid) }}
                            </li>
                            <li v-if="task.assignedTo" class="dropdown-item" @click="unassignTask(task)">
                              <span class="text-danger">Unassign</span>
                            </li>
                          </ul>
                        </div>
                        <div v-else class="assigned-user">{{ getMemberName(selectedGroup, task.assignedTo) }}</div>
                      </div>
                    </div>
                  </div>
                </li>
              </template>
            </draggable>

            <button class="button-add" data-bs-toggle="modal" data-bs-target="#createTaskModal" @click="openModal(status)">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </template>
      </draggable>
    </div>

    <div v-else class="no-group-selected">
      <div class="card text-center p-4">
        <i class="fa-solid fa-users fa-3x text-primary mb-3"></i>
        <h4>No Group Selected</h4>
        <p class="text-muted">Pick a group to view and manage tasks.</p>
      </div>
    </div>
  </div>

  <AddTaskModal ref="taskModalRef" @taskAdded="fetchTasks" />
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { Toaster, toast } from "vue-sonner";
import draggable from "vuedraggable";
import { useGroupStore } from "@/stores/groupStore";
import { useTaskStore } from "@/stores/taskStore";
import { getAuth } from "firebase/auth";
import AddTaskModal from "@/components/modals/AddTaskModal.vue";

type Task = (typeof taskStore.tasks)[0];


interface Member {
  uid: string;
  firstName?: string;
  lastName?: string;
}

interface Group {
  code: string;
  name: string;
  owner: string;
  members: Member[];
}

const groupStore = useGroupStore();
const taskStore = useTaskStore();
const selectedGroup = computed<Group | null>(() => groupStore.selectedGroup);
const draggedTask = ref<Task | null>(null);
const statuses = computed<string[]>(() => groupStore.statuses);
const auth = getAuth();
const editingTaskId = ref<string | null>(null);
const editingTaskName = ref("");
const editInput = ref<HTMLInputElement | null>(null);

const sortDirection = ref<"none" | "asc" | "desc">("none");

const priorityMap: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  null: 0,
  undefined: 0,
};

const toggleSorting = () => {
  if (sortDirection.value === "none") {
    sortDirection.value = "desc";
  } else if (sortDirection.value === "desc") {
    sortDirection.value = "asc";
  } else {
    sortDirection.value = "none";
  }
};

const getSortedTasksForStatus = (status: string): Task[] => {
  const tasksForStatus = taskStore.tasks.filter((task) => task.status === status);

  if (sortDirection.value === "none") {
    return tasksForStatus;
  }

  return [...tasksForStatus].sort((a, b) => {
    const priorityA = priorityMap[a.priority || "undefined"] || 0;
    const priorityB = priorityMap[b.priority || "undefined"] || 0;

    return sortDirection.value === "asc" ? priorityA - priorityB : priorityB - priorityA;
  });
};
const customCompletionValue = ref("0");

// Helper function to check if user can edit a task
const canEditTask = (task: Task): boolean => {
  // Owner can edit all tasks
  if (isGroupOwner.value) return true;

  // User can edit tasks assigned to them
  if (task.assignedTo === auth.currentUser?.uid) return true;

  // User can edit unassigned tasks
  if (!task.assignedTo) return true;

  // Otherwise, no edit permission
  return false;
};

const updateCompletion = async (task: Task, event: Event) => {
  // Check if task is completed
  if (task.status === "Completed") {
    toast.info("Tasks in 'Completed' status are already 100% complete.");
    return;
  }

  // Check permissions: only owner, assigned user or unassigned tasks
  if (!canEditTask(task)) {
    toast.error("You can only update progress of tasks assigned to you or unassigned tasks.");
    return;
  }

  const value = parseInt((event.target as HTMLInputElement).value);
  try {
    await taskStore.updateTaskCompletion(task.id, value);
  } catch (error) {
    console.error("Failed to update task completion:", error);
    toast.error("Failed to update task completion");
  }
};

const setTaskCompletion = async (task: Task, completion: number) => {
  // Check if task is completed
  if (task.status === "Completed") {
    toast.info("Tasks in 'Completed' status are already 100% complete.");
    return;
  }

  // Check permissions: only owner, assigned user or unassigned tasks
  if (!canEditTask(task)) {
    toast.error("You can only update progress of tasks assigned to you or unassigned tasks.");
    return;
  }

  if (isNaN(completion) || completion < 0 || completion > 100) {
    toast.error("Value must be between 0 and 100");
    return;
  }

  try {
    await taskStore.updateTaskCompletion(task.id, completion);
    toast.success(`Task progress updated to ${completion}%`);
  } catch (error) {
    console.error("Failed to update task completion:", error);
    toast.error("Failed to update task completion");
  }
};

const isGroupOwner = computed(() => {
  if (!selectedGroup.value || !auth.currentUser) return false;
  return selectedGroup.value.owner === auth.currentUser.uid;
});

const getPriorityColor = (priority: string | null): string => {
  if (!priority) return "secondary";

  switch (priority) {
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "success";
    default:
      return "secondary";
  }
};

const setTaskPriority = async (task: Task, priority: string | null) => {
  try {
    await taskStore.updateTaskPriority(task.id, priority);
  } catch (error: any) {
    toast.error("Failed to update task priority:", error);
    console.error("Failed to update task priority:", error);
  }
};

const canUpdateTaskStatus = (oldStatus: string, newStatus: string): boolean => {
  if (isGroupOwner.value) return true;

  return oldStatus !== "Completed" && newStatus !== "Completed";
};

const reorderColumns = () => {
  console.log("New order:", groupStore.statuses);
  groupStore.updateStatuses(groupStore.statuses);
};

const fetchTasks = async () => {
  if (selectedGroup.value) {
    await taskStore.fetchTasksForGroup(selectedGroup.value.code);
  }
};

interface DragEvent {
  item: {
    __draggable_context?: {
      element: Task;
    };
  };
  to?: {
    parentElement?: {
      querySelector: (selector: string) => HTMLElement | null;
    };
  };
}

const startTaskDrag = (event: DragEvent) => {
  console.log("Drag started:", event);
  draggedTask.value = event.item.__draggable_context?.element || null;
  console.log("Dragged Task:", draggedTask.value);
};

const endTaskDrag = async (event: DragEvent) => {
  console.log("Drag ended:", event);
  console.log("Dragged Task Before Update:", draggedTask.value);

  if (!draggedTask.value) {
    console.warn("No task was dragged.");
    return;
  }

  const newStatus = event.to?.parentElement?.querySelector("h4")?.innerText || draggedTask.value.status;
  const taskId = draggedTask.value.id;
  const oldStatus = draggedTask.value.status;

  console.log(`Task ${taskId} moved from ${oldStatus} to ${newStatus}`);

  if (!canUpdateTaskStatus(oldStatus, newStatus)) {
    console.log("User cannot change this task status, reverting...");
    await fetchTasks();
    return;
  }

  if (oldStatus === newStatus) {
    console.log("Status unchanged, no update needed.");
    draggedTask.value = null;
    return;
  }

  try {
    // Update status
    await taskStore.updateTaskStatus(taskId, newStatus);
    console.log(`Updated task ${taskId} in store.`);

    // If task is moved to "Completed", set completion to 100%
    if (newStatus === "Completed") {
      const taskIndex = taskStore.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1) {
        await taskStore.updateTaskCompletion(taskId, 100);
        console.log(`Task ${taskId} completion set to 100% as it was moved to Completed.`);
      }
    }
  } catch (error) {
    console.error("Error updating task status:", error);
  }

  draggedTask.value = null;
};

const editTask = (task: Task) => {
  editingTaskId.value = task.id;
  editingTaskName.value = task.name;

  nextTick(() => {
    if (editInput.value) {
      editInput.value.focus();
    }
  });
};

const saveTaskName = async (taskId: string) => {
  if (editingTaskName.value.trim() === "") return;

  try {
    await taskStore.updateTaskName(taskId, editingTaskName.value);
    cancelEdit();
    toast.success("The task has been edited");
  } catch (error: any) {
    toast.error("Failed to update task name:", error);
    console.error("Failed to update task name:", error);
  }
};

const cancelEdit = () => {
  editingTaskId.value = null;
  editingTaskName.value = "";
};

const deleteTask = async (task: Task) => {
  try {
    await taskStore.deleteTask(task.id);
    toast.success("The task has been deleted");
  } catch (error: any) {
    toast.error("Failed to delete task:", error);
    console.error("Failed to delete task:", error);
  }
};

const toggleFavorite = async (task: Task) => {
  try {
    const newValue = !task.isFavorite;
    await taskStore.updateTaskFavorite(task.id, newValue);
  } catch (error: any) {
    toast.error("Failed to toggle favorite:", error);
    console.error("Failed to toggle favorite:", error);
  }
};

const assignTaskToUser = async (task: Task, member: Member | string) => {
  try {
    const userId = typeof member === "string" ? member : member.uid;
    await taskStore.updateTaskAssignment(task.id, userId);
  } catch (error: any) {
    toast.error("Failed to assign task to user:", error);
    console.error("Failed to assign task to user:", error);
  }
};

const unassignTask = async (task: Task) => {
  try {
    await taskStore.updateTaskAssignment(task.id, null);
  } catch (error: any) {
    toast.error("Failed to unassign task:", error);
    console.error("Failed to unassign task:", error);
  }
};

const taskModalRef = ref<InstanceType<typeof AddTaskModal> | null>(null);

const openModal = (status: string) => {
  if (taskModalRef.value) {
    taskModalRef.value.setTaskStatus(status);
  }
};

onMounted(async () => {
  await groupStore.fetchGroups();
});

const getMemberName = (group: Group, memberId: string | null): string => {
  if (!memberId) return "Unassigned";

  if (memberId === auth.currentUser?.uid) {
    return "You";
  }

  const memberDetails = group.members.find((m) => m.uid === memberId);

  if (memberDetails) {
    return `${memberDetails.firstName || ""} ${memberDetails.lastName || ""}`.trim() || memberId.substring(0, 8);
  }

  return memberId.substring(0, 8) + "...";
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

watch(
  () => groupStore.statuses,
  (newStatuses) => {
    console.log("Saving new column order:", newStatuses);
    groupStore.updateStatuses(newStatuses);
  },
  { deep: true }
);

onMounted(() => {
  if (selectedGroup.value) {
    fetchTasks();
  }
});
</script>
<style scoped>
.restricted-column {
  background-color: rgba(0, 0, 0, 0.03);
}

.priority-high {
  border-left: 4px solid #dc3545 !important;
}

.priority-medium {
  border-left: 4px solid #ffc107 !important;
}

.priority-low {
  border-left: 4px solid #28a745 !important;
}

.priority-indicator {
  margin-right: 8px;
  display: inline-block;
}

.task-list {
  list-style: none;
  padding: 0;
  min-height: 50px;
}
.completion-btn {
  font-size: 0.85rem;
  padding: 3px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
}
.task-card {
  padding: 10px;
  background-color: #e8e8e8;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: grab;
  display: flex;
  flex-direction: column;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.task-title-wrapper {
  display: flex;
  align-items: center;
  flex-grow: 1;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.task-details {
  width: 100%;
}

.task-date {
  font-size: 0.8rem;
  color: #666;
  margin-top: 3px;
  margin-bottom: 8px;
}

.task-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
}

.task-priority,
.task-assignment {
  min-width: 100px;
}

.priority-btn,
.assign-btn {
  font-size: 0.85rem;
  padding: 3px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
  display: inline-block;
}

.assigned-user {
  font-size: 0.85rem;
  padding: 2px 6px;
  background-color: #e9ecef;
  border-radius: 4px;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}

.favorite-task {
  border-right: 3px solid red;
}

.task-column {
  min-height: 200px;
  border: 1px dashed #ccc;
  transition: background-color 0.3s;
}

.task-column.drag-over {
  background-color: #f5f5f5;
}

.home-container {
  padding: 20px;
  background: #1e5c88;
  min-height: 100vh;
}

.task-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  align-items: start;
  padding-bottom: 10px;
  max-width: 90%;
  margin: auto;
}

.task-column {
  background: white;
  padding: 15px;
  border-radius: 8px;
  min-height: 200px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.column-header {
  font-weight: bold;
  font-size: 18px;
  text-align: center;
  padding-bottom: 10px;
}

.button-add {
  width: 100%;
  font-size: 18px;
  cursor: pointer;
  margin-top: 10px;
  background: #007bff;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 5px;
  text-align: center;
}

.button-add:hover {
  background: #0056b3;
}

.sorting-controls {
  max-width: 90%;
  margin: 0 auto 15px auto;
  display: flex;
  justify-content: flex-end;
}

.sort-button {
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.sort-button:hover {
  background-color: #e0e0e0;
}

@media (max-width: 640px) {
  .task-controls {
    flex-direction: column;
  }

  .task-priority,
  .task-assignment {
    width: 100%;
  }

  .priority-btn,
  .assign-btn {
    width: 100%;
    max-width: none;
  }
}
</style>
