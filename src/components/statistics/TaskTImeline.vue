<!-- src/components/tasks/TaskTimeline.vue -->
<template>
  <div class="task-timeline card">
    <div class="card-header d-flex justify-content-between align-items-center">
      <h5 class="mb-0">{{ task.name }}</h5>
      <button class="btn-close" @click="$emit('close')"></button>
    </div>

    <div class="card-body">
      <div class="task-details mb-4">
        <div class="row">
          <div class="col-md-6">
            <p><strong>Status:</strong> {{ task.status }}</p>
            <p><strong>Date Created:</strong> {{ formatDate(task.createdAt) }}</p>
            <p><strong>Assigned To:</strong> {{ getAssigneeName(task.assignedTo) }}</p>
          </div>
          <div class="col-md-6">
            <p><strong>Priority:</strong> {{ task.priority || "None" }}</p>
            <p><strong>Completion:</strong> {{ task.completion || 0 }}%</p>
            <p><strong>Last Updated:</strong> {{ formatDate(task.updatedAt) }}</p>
          </div>
        </div>
      </div>

      <h6>Task Timeline</h6>

      <div v-if="loading" class="text-center py-3">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <div v-else-if="timelineEvents.length === 0" class="text-center py-3 text-muted">
        <p>No timeline data available for this task.</p>
      </div>

      <div v-else class="timeline">
        <div v-for="(event, index) in timelineEvents" :key="index" class="timeline-item">
          <div class="timeline-badge" :class="getStatusClass(event.newValue)"></div>
          <div class="timeline-content">
            <h6 class="mb-1">{{ event.newValue }}</h6>
            <p class="mb-0 text-muted">
              {{ formatDate(event.timestamp) }}
              <span v-if="event.duration"> • {{ formatDuration(event.duration) }}</span>
            </p>
            <small v-if="event.userId" class="text-muted">by {{ getUserName(event.userId) }}</small>
          </div>
        </div>
      </div>

      <div class="time-summary mt-4">
        <h6>Time in Each Status</h6>
        <ul class="list-group">
          <li v-for="status in statusDurations" :key="status.name" class="list-group-item d-flex justify-content-between align-items-center">
            <span>{{ status.name }}</span>
            <span class="badge bg-primary rounded-pill">{{ formatDuration(status.duration) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { format, formatDistance, differenceInMilliseconds } from "date-fns";

// Definicja typów
interface Task {
  id: string;
  name: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  assignedTo?: string | null;
  priority?: string | null;
  completion?: number;
  createdBy?: string;
  [key: string]: any;
}

interface TimelineEvent {
  id?: string;
  newValue: string;
  oldValue?: string;
  timestamp: Date;
  userId?: string;
  duration?: number;
  changeType?: string;
}

interface StatusDuration {
  name: string;
  duration: number;
}

const props = defineProps<{
  task: Task;
}>();

defineEmits<{
  close: [];
}>();

const timelineEvents = ref<TimelineEvent[]>([]);
const loading = ref(true);

const fetchTaskTimeline = async (): Promise<void> => {
  if (!props.task.id) return;

  try {
    loading.value = true;

    // Fetch status change events from activity logs
    const eventsQuery = query(collection(db, "activity_logs"), where("taskId", "==", props.task.id), where("changeType", "==", "status_change"), orderBy("timestamp", "asc"));

    const snapshot = await getDocs(eventsQuery);

    if (snapshot.empty) {
      timelineEvents.value = [];
      loading.value = false;
      return;
    }

    // Process events and calculate durations
    const events: TimelineEvent[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        newValue: data.newValue || "",
        oldValue: data.oldValue,
        timestamp: new Date(data.timestamp),
        userId: data.userId,
        changeType: data.changeType,
      };
    });

    // Add task creation as first event
    if (props.task.createdAt) {
      events.unshift({
        newValue: props.task.status || "To Do",
        timestamp: new Date(props.task.createdAt),
        userId: props.task.createdBy,
      });
    }

    // Calculate duration for each status period
    for (let i = 0; i < events.length - 1; i++) {
      events[i].duration = differenceInMilliseconds(events[i + 1].timestamp, events[i].timestamp);
    }

    // For the latest status, calculate duration until now
    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      lastEvent.duration = differenceInMilliseconds(new Date(), lastEvent.timestamp);
    }

    timelineEvents.value = events;
  } catch (error) {
    console.error("Error fetching task timeline:", error);
  } finally {
    loading.value = false;
  }
};

const statusDurations = computed((): StatusDuration[] => {
  const durations: Record<string, number> = {};

  timelineEvents.value.forEach((event) => {
    if (event.newValue && event.duration) {
      if (!durations[event.newValue]) {
        durations[event.newValue] = 0;
      }
      durations[event.newValue] += event.duration;
    }
  });

  return Object.entries(durations)
    .map(([name, duration]) => ({
      name,
      duration,
    }))
    .sort((a, b) => b.duration - a.duration);
});

const getStatusClass = (status: string): string => {
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

const formatDate = (dateString?: string | Date): string => {
  if (!dateString) return "Unknown";
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  return format(date, "MMM d, yyyy h:mm a");
};

const formatDuration = (milliseconds?: number): string => {
  if (!milliseconds) return "";

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `<1m`;
  }
};

const getUserName = (userId?: string): string => {
  // Implement based on your user data structure
  return userId || "Unknown User";
};

const getAssigneeName = (assigneeId?: string | null): string => {
  if (!assigneeId) return "Unassigned";
  // Implement based on your user data structure
  return assigneeId.substring(0, 8) + "...";
};

onMounted(() => {
  fetchTaskTimeline();
});

watch(
  () => props.task,
  (newValue) => {
    if (newValue && newValue.id) {
      fetchTaskTimeline();
    }
  }
);
</script>

<style scoped>
.task-timeline {
  max-height: 80vh;
  overflow-y: auto;
}

.timeline {
  position: relative;
  padding: 20px 0;
  margin-left: 20px;
}

.timeline::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 7px;
  width: 2px;
  background: #e9ecef;
}

.timeline-item {
  position: relative;
  margin-bottom: 30px;
}

.timeline-badge {
  position: absolute;
  top: 0;
  left: -27px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  z-index: 1;
}

.timeline-content {
  padding-left: 20px;
}
</style>
