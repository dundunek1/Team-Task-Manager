<!-- src/components/activity/ActivityFeed.vue -->
<template>
  <div class="activity-feed">
    <h4 class="mb-3">Recent Activity</h4>

    <div v-if="loading" class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <div v-else-if="activityLogs.length === 0" class="text-center text-muted">
      <p>No recent activity to display.</p>
    </div>

    <ul v-else class="list-group">
      <li v-for="log in activityLogs" :key="log.id" class="list-group-item">
        <div class="d-flex justify-content-between">
          <div>
            <span class="activity-icon" :class="getActivityIconClass(log.changeType)">
              <i :class="getActivityIcon(log.changeType)"></i>
            </span>
            <strong>{{ getTaskName(log.taskId) }}</strong>
            <span>{{ getActivityDescription(log) }}</span>
          </div>
          <small class="text-muted">{{ formatTime(log.timestamp) }}</small>
        </div>
        <small class="text-muted">by {{ getUserName(log.userId) }}</small>
      </li>
    </ul>

    <div v-if="activityLogs.length > 0 && hasMoreActivities" class="text-center mt-3">
      <button class="btn btn-outline-primary btn-sm" @click="loadMoreActivities">Load More</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { collection, query, where, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { useGroupStore } from "@/stores/groupStore";
import { useTaskStore } from "@/stores/taskStore";
import { formatDistanceToNow } from "date-fns";

// Definicja typów
interface ActivityLog {
  id: string;
  taskId: string;
  changeType: string;
  oldValue: any;
  newValue: any;
  userId: string;
  timestamp: Date;
  groupCode: string;
}

const groupStore = useGroupStore();
const taskStore = useTaskStore();
const selectedGroup = computed(() => groupStore.selectedGroup);

const activityLogs = ref<ActivityLog[]>([]);
const loading = ref(true);
const lastVisible = ref<QueryDocumentSnapshot<DocumentData> | null>(null);
const hasMoreActivities = ref(true);
const LOGS_PER_PAGE = 10;

const fetchActivityLogs = async (startAfterDoc: QueryDocumentSnapshot<DocumentData> | null = null): Promise<void> => {
  if (!selectedGroup.value) return;

  try {
    loading.value = true;

    let activitiesQuery = query(collection(db, "activity_logs"), where("groupCode", "==", selectedGroup.value.code), orderBy("timestamp", "desc"), limit(LOGS_PER_PAGE));

    if (startAfterDoc) {
      activitiesQuery = query(activitiesQuery, startAfter(startAfterDoc));
    }

    const snapshot = await getDocs(activitiesQuery);

    if (snapshot.empty) {
      hasMoreActivities.value = false;
      loading.value = false;
      return;
    }

    lastVisible.value = snapshot.docs[snapshot.docs.length - 1];

    const logs: ActivityLog[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        taskId: data.taskId || "",
        changeType: data.changeType || "",
        oldValue: data.oldValue,
        newValue: data.newValue,
        userId: data.userId || "",
        timestamp: new Date(data.timestamp),
        groupCode: data.groupCode || "",
      };
    });

    if (startAfterDoc) {
      activityLogs.value = [...activityLogs.value, ...logs];
    } else {
      activityLogs.value = logs;
    }

    hasMoreActivities.value = snapshot.docs.length === LOGS_PER_PAGE;
  } catch (error) {
    console.error("Error fetching activity logs:", error);
  } finally {
    loading.value = false;
  }
};

const loadMoreActivities = (): void => {
  if (lastVisible.value) {
    fetchActivityLogs(lastVisible.value);
  }
};

const getTaskName = (taskId: string): string => {
  const task = taskStore.tasks.find((t) => t.id === taskId);
  return task ? task.name : "Unknown Task";
};

const getUserName = (userId: string): string => {
  // Implement based on your user data structure
  // Could fetch from a users collection or from group members
  return userId || "Unknown User";
};

const getActivityIcon = (changeType: string): string => {
  switch (changeType) {
    case "status_change":
      return "fa-solid fa-arrows-up-down";
    case "completion_update":
      return "fa-solid fa-percentage";
    case "assignment_change":
      return "fa-solid fa-user-tag";
    case "priority_change":
      return "fa-solid fa-flag";
    default:
      return "fa-solid fa-edit";
  }
};

const getActivityIconClass = (changeType: string): string => {
  switch (changeType) {
    case "status_change":
      return "bg-info";
    case "completion_update":
      return "bg-success";
    case "assignment_change":
      return "bg-warning";
    case "priority_change":
      return "bg-danger";
    default:
      return "bg-secondary";
  }
};

const getActivityDescription = (log: ActivityLog): string => {
  switch (log.changeType) {
    case "status_change":
      return `moved from ${log.oldValue} to ${log.newValue}`;
    case "completion_update":
      return `progress updated from ${log.oldValue}% to ${log.newValue}%`;
    case "assignment_change":
      return `reassigned from ${getUserName(log.oldValue)} to ${getUserName(log.newValue)}`;
    case "priority_change":
      return `priority changed from ${log.oldValue || "none"} to ${log.newValue || "none"}`;
    default:
      return `was updated`;
  }
};

const formatTime = (timestamp: Date): string => {
  return formatDistanceToNow(timestamp, { addSuffix: true });
};

onMounted(() => {
  if (selectedGroup.value) {
    fetchActivityLogs();
  }
});

watch(
  () => selectedGroup.value,
  (newValue) => {
    if (newValue) {
      activityLogs.value = [];
      lastVisible.value = null;
      hasMoreActivities.value = true;
      fetchActivityLogs();
    }
  }
);
</script>

<style scoped>
.activity-feed {
  max-height: 500px;
  overflow-y: auto;
}

.activity-icon {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  text-align: center;
  line-height: 24px;
  color: white;
  margin-right: 8px;
}

.list-group-item {
  transition: background-color 0.2s;
}

.list-group-item:hover {
  background-color: #f8f9fa;
}
</style>
